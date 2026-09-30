import { useEffect, useState } from 'react';
import { accountRequest } from './account-api';

const labels = { processing: 'Processando', sent: 'Enviado', failed: 'Falha no envio', setup_failed: 'Configuração pendente' };
export default function AdminInvitations() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function reload() {
    try { const data = await accountRequest('invitations'); setRows(data.invitations); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { reload(); }, []);
  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await accountRequest('invitations', { email: new FormData(form).get('email') });
      setNotice(result.message); form.reset();
    } catch (e) { setError(e.message); }
    finally { await reload(); setBusy(false); }
  }
  return <section className="settings-panel"><h2>Convidar profissional</h2><p>Somente você autoriza novas contas. Cada profissional terá seu próprio espaço.</p><form onSubmit={submit}><label className="field"><span>E-mail do profissional</span><input name="email" type="email" required maxLength={254}/></label><button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar convite'}</button></form><p className="help-note">O convite confirma o e-mail. A senha temporária deve ser trocada antes de acessar os clientes. Convites já registrados não são reenviados automaticamente.</p>{error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<h3>Últimos convites</h3>{rows.length === 0 ? <p>Nenhum convite registrado.</p> : <ul>{rows.map(row => <li key={row.email}><strong>{row.email}</strong> — {labels[row.status] || row.status}</li>)}</ul>}<button className="text-button" disabled={busy} onClick={() => { setError(''); reload(); }}>Atualizar lista</button></section>;
}
