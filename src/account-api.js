import { supabase } from './supabase';

export async function accountRequest(path, body) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Entre novamente para continuar.');
  const response = await fetch(`/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a solicitação.');
  return result;
}
