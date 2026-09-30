import { adminClient, authenticate, respondError, validatePassword } from '../server/accounts.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const client = adminClient();
    const user = await authenticate(req, client);
    if (user.app_metadata?.must_change_password !== true) return res.status(403).json({ error: 'A definição inicial de senha não está pendente.' });
    const password = req.body?.password;
    if (!process.env.INVITE_TEMP_PASSWORD) throw new Error('Missing temporary password');
    if (!validatePassword(password, process.env.INVITE_TEMP_PASSWORD)) return res.status(400).json({ error: 'Use de 10 a 128 caracteres e uma senha diferente da temporária.' });
    // Password and trusted access flag change together; never accept metadata from the client.
    const { error } = await client.auth.admin.updateUserById(user.id, { password, app_metadata: { must_change_password: false } });
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) { return respondError(res, error); }
}
