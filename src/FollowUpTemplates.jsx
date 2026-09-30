import { useState } from 'react';
import { Plus, Pencil, Archive, CalendarDays, MessageCircle } from 'lucide-react';
import { feedbackBody, returnBody, parseDays, renderMessage } from './follow-ups';

export default function FollowUpTemplates({ templates, busy, onSave, onArchive }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const visible = templates.filter(t => Boolean(t.archived_at) === showArchived).sort((a, b) => Math.min(...a.days) - Math.min(...b.days));
  function edit(template) { setError(''); setEditing({ id: template.id || null, title: template.title, body: template.body, days: template.days.join(', ') }); }
  async function submit(event) {
    event.preventDefault(); setError('');
    try {
      const days = parseDays(editing.days);
      if (!editing.title.trim() || !editing.body.trim()) throw new Error('Preencha o nome do modelo e o texto da mensagem.');
      const clash = templates.find(t => t.id !== editing.id && !t.archived_at && t.days.some(d => days.includes(d)));
      if (clash) throw new Error(`Um desses dias já está no modelo “${clash.title}”. Escolha outro dia ou edite esse modelo.`);
      await onSave({ id: editing.id, title: editing.title.trim(), body: editing.body.trim(), days });
      setEditing(null);
    } catch (e) { setError(e.message); }
  }
  return <div className="template-page">
    <div className="queue-note"><CalendarDays size={22}/><p>Conte os dias a partir do atendimento. Use o mesmo texto em vários dias ou crie mensagens diferentes para cada momento. O último dia selecionado encerra o acompanhamento.</p></div>
    <div className="section-head"><div><h2>Sua biblioteca de mensagens</h2><p>Os modelos ficam disponíveis somente na sua conta.</p></div><button className="primary" disabled={busy} onClick={() => edit({ title: '', body: '', days: [7] })}><Plus size={17}/>Nova mensagem</button></div>
    {!templates.some(t => !t.archived_at) && !editing && <div className="template-starters"><p>Comece com um exemplo e ajuste o texto ao seu atendimento:</p><button className="secondary" onClick={() => edit({ title: 'Feedback e recuperação', body: feedbackBody, days: [7, 15] })}>Feedback · dias 7 e 15</button><button className="secondary" onClick={() => edit({ title: 'Convite para retorno', body: returnBody, days: [60] })}>Retorno · dia 60</button></div>}
    {editing && <form className="template-editor" onSubmit={submit}>
      <h2>{editing.id ? 'Editar mensagem padrão' : 'Cadastrar mensagem padrão'}</h2>
      <div className="form-grid"><label className="field"><span>Nome do modelo</span><input autoFocus required maxLength={100} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Ex.: feedback e recuperação"/></label><label className="field"><span>Dias após o atendimento</span><input required value={editing.days} onChange={e => setEditing({ ...editing, days: e.target.value })} placeholder="7, 15"/><small>Separe por vírgula. Ex.: 7, 15 ou 60.</small></label></div>
      <label className="field"><span>Texto da mensagem</span><textarea required rows={5} maxLength={3000} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} placeholder="Olá, {nome}! Como você está?"/></label>
      <p className="help-note">Use <code>{'{nome}'}</code> para o nome do cliente e <code>{'{servico}'}</code> para o atendimento realizado.</p>
      <div className="template-preview"><strong>Prévia · Mariana / limpeza de pele</strong><p>{renderMessage(editing.body || 'Seu texto aparecerá aqui.', 'Mariana', 'limpeza de pele')}</p></div>
      <p className="help-note">Salvar altera somente os próximos atendimentos. Mensagens já programadas continuam com o texto original.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="template-actions"><button className="secondary" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar mensagem'}</button></div>
    </form>}
    <div className="tabs"><button className={!showArchived ? 'selected' : ''} onClick={() => setShowArchived(false)}>Disponíveis</button><button className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(true)}>Arquivadas</button></div>
    <div className="messages-grid">{visible.map(t => <article className="message-card" key={t.id}><div className="message-top"><MessageCircle size={22}/><h3>{t.title}</h3></div><div className="template-days">{t.days.map(day => <span className="badge" key={day}>Dia {day}</span>)}</div><p className="message-body">{t.body}</p><div className="template-actions"><button className="secondary" disabled={busy} onClick={() => edit(t)}><Pencil size={16}/>{t.archived_at ? 'Editar e restaurar' : 'Editar'}</button>{!t.archived_at && <button className="text-button" disabled={busy} onClick={() => onArchive(t.id)}><Archive size={16}/>Arquivar</button>}</div></article>)}</div>
    {!visible.length && <p className="help-note">{showArchived ? 'Nenhuma mensagem arquivada.' : 'Cadastre seus modelos para selecionar os dias ao registrar um atendimento.'}</p>}
  </div>;
}
