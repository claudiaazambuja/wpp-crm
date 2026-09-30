import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Administração ainda não configurada no servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticate(req, client, adminOnly = false) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error('Entre na sua conta.'), { status: 401 });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const user = data.user;
  if (adminOnly && (user.app_metadata?.role !== 'admin' || user.app_metadata?.must_change_password !== false)) {
    throw Object.assign(new Error('Acesso exclusivo do administrador.'), { status: 403 });
  }
  return user;
}

export function respondError(res, error) {
  return res.status(error.status || 503).json({ error: error.status ? error.message : 'Não foi possível concluir. Confira a configuração do servidor e tente novamente.' });
}

export function validatePassword(password, temporary) {
  return typeof password === 'string' && password.length >= 10 && password.length <= 128 && password !== temporary;
}
