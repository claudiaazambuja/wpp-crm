import { useState } from 'react';
import { feedbackBody, templateSteps } from './follow-ups';

export default function FollowUpSelection({ templates }) {
  // Freeze this draft so background refreshes cannot alter the chosen schedule.
  const [steps] = useState(() => templateSteps(templates));
  const [selected, setSelected] = useState(() => steps.map(s => s.key));
  const [mode, setMode] = useState(steps.length ? 'templates' : 'custom');
  const [customDays, setCustomDays] = useState('7, 15');
  const [customBody, setCustomBody] = useState(feedbackBody);
  const [requestId] = useState(() => crypto.randomUUID());
  const days = mode === 'templates' ? steps.filter(s => selected.includes(s.key)).map(s => s.day) : customDays.split(/[,;\s]+/).filter(Boolean).map(Number).filter(d => Number.isInteger(d) && d >= 1 && d <= 3650);
  return <section className="follow-up-selection">
    <h3>Dias e mensagens de acompanhamento</h3><p className="help-note">Selecione os contatos que este cliente deve receber.</p>
    <div className="tabs"><button type="button" className={mode === 'templates' ? 'selected' : ''} disabled={!steps.length} onClick={() => setMode('templates')}>Mensagens padrão</button><button type="button" className={mode === 'custom' ? 'selected' : ''} onClick={() => setMode('custom')}>Personalizar neste atendimento</button></div>
    <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="schedule_mode" value={mode}/>
    {mode === 'templates' ? <><input type="hidden" name="schedule" value={JSON.stringify(steps.filter(s => selected.includes(s.key)))}/><div className="follow-up-choices">{steps.map(s => <label key={s.key} className="follow-up-choice"><input type="checkbox" checked={selected.includes(s.key)} onChange={e => setSelected(current => e.target.checked ? [...current, s.key] : current.filter(k => k !== s.key))}/><span><strong>Dia {s.day}</strong><small>{s.title}</small></span></label>)}</div></> : <><label className="field"><span>Dias após o atendimento</span><input name="custom_days" required value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="7, 15, 60"/></label><label className="field"><span>Mensagem para os dias escolhidos</span><textarea name="custom_body" required rows={3} maxLength={3000} value={customBody} onChange={e => setCustomBody(e.target.value)}/></label><p className="help-note">Para usar textos diferentes em cada dia, cadastre modelos na página Mensagens padrão. Use {'{nome}'} e {'{servico}'} para personalizar o texto.</p></>}
    <p className="sequence-summary" role="status">{days.length ? `${days.length} contato${days.length > 1 ? 's' : ''} · último contato no dia ${Math.max(...days)} após o atendimento.` : 'Selecione pelo menos um dia.'}</p>
  </section>;
}
