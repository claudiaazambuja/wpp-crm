import { adminClient, authenticate, respondError } from '../server/accounts.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end();
  try {
    const client = adminClient();
    const user = await authenticate(req, client, true);
    if (req.method === 'GET') {
      const { data, error } = await client.from('account_invitations').select('email,status,created_at').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return res.json({ invitations: data });
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    const temporary = process.env.INVITE_TEMP_PASSWORD;
    if (!temporary || temporary.length < 8) throw new Error('Missing temporary password');
    // A unique reservation prevents retries or parallel clicks from sending duplicates.
    const { error: reservation } = await client.from('account_invitations').insert({ email, invited_by: user.id, status: 'processing' });
    if (reservation?.code === '23505') return res.status(409).json({ error: 'Este e-mail já tem um convite registrado. Consulte a lista antes de tentar novamente.' });
    if (reservation) throw reservation;
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, { redirectTo: 'https://proxima-crm.vercel.app/' });
    if (error) {
      await client.from('account_invitations').update({ status: 'failed' }).eq('email', email);
      return res.status(400).json({ error: 'Convite não enviado. A conta pode já existir ou o serviço de e-mail pode estar indisponível. Peça ao responsável para revisar no Supabase.' });
    }
    // The Auth insert trigger blocks data access before the email can be opened.
    const { error: setup } = await client.auth.admin.updateUserById(data.user.id, { password: temporary, app_metadata: { must_change_password: true } });
    const { error: recorded } = await client.from('account_invitations').update({ user_id: data.user.id, status: setup ? 'setup_failed' : 'sent' }).eq('email', email);
    if (setup || recorded) return res.status(503).json({ error: 'O convite foi enviado, mas a configuração ficou pendente. Não envie novamente; solicite a revisão do administrador.' });
    return res.status(201).json({ message: 'Convite enviado. O profissional deve abrir o e-mail e definir sua senha pessoal.' });
  } catch (error) { return respondError(res, error); }
}
