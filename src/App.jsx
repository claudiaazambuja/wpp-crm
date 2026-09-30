import { useEffect, useRef, useState } from 'react';
import { Heart, LayoutDashboard, Users, MessageCircle, Settings, Search, Plus, ArrowUpRight, ArrowRight, Sun, Moon, X, Check, Clock, CalendarDays, LogOut, RefreshCw, ChevronRight, ShieldCheck } from 'lucide-react';
import { supabase } from './supabase';
import AdminInvitations from './AdminInvitations';
import { accountRequest } from './account-api';
import { demoData } from './demo';
import { today, dateLabel, scheduledDate, normalizePhone, messageBucket, whatsappUrl } from './domain';

const empty = { clients: [], appointments: [], messages: [], anamneses: [], profile: null };
const startInDemo = new URLSearchParams(window.location.search).get('demo') === '1';
const incomingAuthType = new URLSearchParams(window.location.hash.slice(1)).get('type');
const intervals = [7, 15, 30, 90, 180];
const anamnesisFields = [['skin_type', 'Tipo de pele'], ['allergies', 'Alergias'], ['medications', 'Medicamentos'], ['care_restrictions', 'Cuidados e restrições'], ['notes', 'Observações gerais']];
function friendly(error) {
  if (error?.code === '23505') return 'Este WhatsApp já está cadastrado. Verifique o número informado.';
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error?.code)) return 'O banco ainda precisa receber a configuração inicial da Próxima.';
  if (/Invalid login/.test(error?.message)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/.test(error?.message)) return 'Confirme seu e-mail antes de entrar.';
  if (/Message is no longer pending/.test(error?.message)) return 'Esse contato já foi atualizado. Atualize a lista antes de continuar.';
  if (error?.status === 401 || /API key/i.test(error?.message)) return 'Não foi possível autenticar a conexão com o Supabase. Confira a configuração do projeto.';
  return error?.message || 'Não foi possível concluir. Tente novamente.';
}
function Field({ label, children, ...props }) { return <label className="field"><span>{label}</span>{children || <input {...props} />}</label>; }
function Modal({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog aria-label={title} ref={ref} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}><header className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>{children}</dialog>;
}
function Brand() { return <div className="brand"><span className="brand-icon"><Heart fill="currentColor" size={23}/></span><span>pró<span className="brand-light">xima</span><small>SEMPRE POR PERTO</small></span></div>; }

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(table === 'client_anamneses' ? 'client_id' : 'id').range(from, from + 999);
    if (error) throw error;
    rows.push(...data); if (data.length < 1000) return rows;
  }
}

export default function App() {
  const [demo, setDemo] = useState(startInDemo);
  const [session, setSession] = useState(null);
  const [passwordSetup, setPasswordSetup] = useState(['invite', 'recovery'].includes(incomingAuthType));
  const [booting, setBooting] = useState(Boolean(supabase) && !startInDemo);
  const [data, setData] = useState(() => startInDemo ? demoData() : empty);
  const [page, setPage] = useState('dashboard');
  const [tab, setTab] = useState('pending');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(startInDemo);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const needsPassword = !demo && session && (passwordSetup || session.user.app_metadata?.must_change_password !== false);
  const isAdmin = !demo && session?.user.app_metadata?.role === 'admin';
  const [theme, setTheme] = useState(() => localStorage.getItem('elocare-theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('elocare-theme', theme); }, [theme]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => { setSession(data.session); if (error) setError(friendly(error)); setBooting(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => { setSession(next); if (event === 'PASSWORD_RECOVERY') setPasswordSetup(true); if (!next && event === 'SIGNED_OUT') { setData(empty); setLoaded(false); } });
    return () => listener.subscription.unsubscribe();
  }, []);
  async function reload() {
    if (demo || !session || needsPassword) return;
    setLoading(true);
    try {
      const [{ data: profile, error: profileError }, clients, appointments, messages, anamneses] = await Promise.all([
        supabase.from('professionals').select('*').eq('id', session.user.id).maybeSingle(), fetchAll('clients'), fetchAll('appointments'), fetchAll('messages'), fetchAll('client_anamneses')
      ]);
      if (profileError) throw profileError;
      setData({ profile, clients, appointments, messages, anamneses }); setLoaded(true); setError('');
    } catch (e) { setError(friendly(e)); } finally { setLoading(false); }
  }
  useEffect(() => {
    if (!session || demo || needsPassword) return;
    reload();
    const timer = setInterval(reload, 30000);
    const focus = () => reload(); window.addEventListener('focus', focus);
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [session?.user.id, demo, Boolean(needsPassword)]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  async function action(fn, success, close = true) {
    setBusy(true); setError('');
    try { await fn(); if (!demo) await reload(); if (close) setModal(null); setNotice(success); }
    catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  }
  function startDemo() { setDemo(true); setData(demoData()); setLoaded(true); setPage('dashboard'); setError(''); }
  function navigate(next) { setPage(next); setQuery(''); window.scrollTo({ top: 0 }); }
  const clients = data.clients.filter(c => !c.archived_at);
  const pending = data.messages.filter(m => messageBucket(m) === 'pending');
  const overdue = pending.filter(m => m.scheduled_at.slice(0, 10) < today());
  const sent = data.messages.filter(m => m.status === 'sent');
  const clientFor = m => data.clients.find(c => c.id === m.client_id);
  const appointmentFor = m => data.appointments.find(a => a.id === m.appointment_id);
  const matches = c => `${c?.full_name} ${c?.whatsapp_number}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());

  async function submitClient(event, clientId) {
    event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      const days = Number(f.interval); if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('Escolha um intervalo de 1 a 3650 dias.');
      let id = clientId || crypto.randomUUID();
      const phone = clientId ? null : normalizePhone(f.whatsapp_number);
      if (demo) {
        if (!clientId && data.clients.some(c => c.whatsapp_number === phone)) throw new Error('Este WhatsApp já está cadastrado.');
        const client = clientId ? data.clients.find(c => c.id === id) : { id, full_name: f.full_name.trim(), whatsapp_number: phone, created_at: new Date().toISOString() };
        const appointment = { id: crypto.randomUUID(), client_id: id, service_description: f.service, appointment_date: f.date, follow_up_interval_days: days, created_at: new Date().toISOString() };
        const message = { id: crypto.randomUUID(), client_id: id, appointment_id: appointment.id, status: 'pending', body: `Olá, ${client.full_name}! Como você está após o nosso atendimento? Estou por aqui se precisar de alguma orientação.`, scheduled_at: scheduledDate(f.date, days) };
        setData(prev => ({ ...prev, clients: clientId ? prev.clients : [...prev.clients, client], appointments: [...prev.appointments, appointment], messages: [...prev.messages.map(m => m.client_id === id && m.status === 'pending' ? { ...m, status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'replaced_by_appointment' } : m), message], anamneses: clientId ? prev.anamneses : [...prev.anamneses, { client_id: id, ...Object.fromEntries(anamnesisFields.map(([key]) => [key, f[key] || ''])) }] }));
      } else {
        const params = { p_service_description: f.service, p_appointment_date: f.date, p_interval_days: days };
        const { error } = clientId ? await supabase.rpc('record_appointment', { ...params, p_client_id: clientId }) : await supabase.rpc('create_client', { ...params, p_full_name: f.full_name.trim(), p_whatsapp_number: phone, p_anamnesis: Object.fromEntries(anamnesisFields.map(([key]) => [key, f[key] || null])) });
        if (error) throw error;
      }
    }, clientId ? 'Atendimento registrado. O prazo de contato foi atualizado.' : 'Cliente cadastrado e primeiro contato programado.');
  }
  async function updateMessage(message, type, values = {}) {
    await action(async () => {
      if (demo) setData(prev => ({ ...prev, messages: prev.messages.map(m => m.id !== message.id ? m : { ...m, ...(type === 'send' ? { status: 'sent', sent_at: new Date().toISOString() } : type === 'cancel' ? { status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'manual' } : type === 'edit' ? { body: values.body } : { scheduled_at: values.scheduled_at }) }) }));
      else { const { error } = await supabase.rpc('update_pending_message', { p_message_id: message.id, p_action: type, p_body: values.body ?? null, p_scheduled_at: values.scheduled_at ?? null }); if (error) throw error; }
    }, type === 'send' ? 'Envio confirmado e registrado no histórico.' : 'Contato atualizado.');
  }

  function MessageCard({ message }) {
    const c = clientFor(message); const a = appointmentFor(message); const late = message.status === 'pending' && message.scheduled_at.slice(0, 10) < today();
    return <article className="message-card"><div className="message-top"><div className="avatar">{c?.full_name.slice(0, 1)}</div><div className="grow"><h3>{c?.full_name || 'Cliente'}</h3><p>{a?.service_description || 'Acompanhamento pós-atendimento'}</p></div><span className={`badge ${late ? 'orange' : message.status === 'sent' ? 'lime' : ''}`}>{message.status === 'sent' ? 'Enviado' : message.status === 'cancelled' ? 'Cancelado' : late ? 'Atrasado' : 'Pendente'}</span></div><p className="message-body">{message.body}</p><div className="message-date"><CalendarDays size={15}/>{dateLabel(message.scheduled_at)}<span>•</span>{c?.whatsapp_number}</div>{message.status === 'pending' ? <><div className="message-actions"><button className="primary" onClick={() => { if (demo) setNotice('Demonstração: nenhum WhatsApp será aberto. Na sua conta, este botão abre a conversa.'); else window.open(whatsappUrl(c.whatsapp_number, message.body), '_blank', 'noopener,noreferrer'); }}><MessageCircle size={17}/>Abrir no WhatsApp<ArrowUpRight size={15}/></button><button className="icon-button confirm-send" title="Marcar como enviado" aria-label={`Marcar mensagem para ${c?.full_name} como enviada`} onClick={() => setModal({ type: 'send', message })}><Check size={19}/></button></div><div className="message-tools"><button onClick={() => setModal({ type: 'edit', message })}>Editar</button><button onClick={() => setModal({ type: 'reschedule', message })}>Reagendar</button><button onClick={() => setModal({ type: 'cancel', message })}>Cancelar</button></div></> : <div className="history-note">{message.status === 'sent' ? `Confirmado manualmente em ${dateLabel(message.sent_at)}` : message.cancellation_reason === 'replaced_by_appointment' ? 'Substituído por um novo atendimento' : 'Cancelado manualmente'}</div>}</article>;
  }

  if (booting) return <div className="auth-page"><Brand/><p>Carregando sua conta…</p></div>;
  if (!demo && !session) return <Auth error={error} setError={setError} onDemo={startDemo}/>;
  if (needsPassword) return <PasswordSetup session={session} onComplete={user => { setSession(prev => ({ ...prev, user })); setPasswordSetup(false); }}/>;
  if (!demo && !isAdmin && loaded && !data.profile) return <div className="auth-page"><Brand/><div className="auth-card"><p className="eyebrow">SUA CONTA</p><h1>Vamos começar?</h1><p>Vincule seu WhatsApp ao seu espaço de trabalho.</p><ProfileForm profile={null} busy={busy} onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); action(async () => { const { error } = await supabase.from('professionals').insert({ id: session.user.id, full_name: f.full_name.trim(), whatsapp_number: normalizePhone(f.whatsapp_number) }); if (error) throw error; }, 'Conta configurada.'); }}/>{error && <p role="alert" className="error">{error}</p>}<button className="text-button" onClick={() => supabase.auth.signOut()}>Sair</button></div></div>;

  return <div className="app-shell"><aside className="sidebar"><Brand/><p className="nav-caption">ESPAÇO DE TRABALHO</p><nav>{[['dashboard', LayoutDashboard, 'Visão geral'], ['clients', Users, 'Clientes'], ['messages', MessageCircle, 'Mensagens'], ['settings', Settings, 'Minha conta'], ...(isAdmin ? [['invitations', ShieldCheck, 'Convites']] : [])].map(([key, Icon, label]) => <button aria-label={label} key={key} className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => navigate(key)}><Icon size={20}/><span>{label}</span>{key === 'messages' && pending.length > 0 && <b>{pending.length}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="connected"><span className="status-dot"/><div><strong>{demo ? 'Modo demonstração' : 'Conta individual'}</strong><small>{demo ? 'Dados fictícios · não salvos' : 'Seu espaço, seus clientes'}</small></div></div><button className="profile-link" onClick={() => navigate('settings')}><span className="avatar small">{data.profile?.full_name?.slice(0, 1) || 'P'}</span><span>{data.profile?.full_name || 'Profissional'}<small>Meu perfil</small></span><ChevronRight size={16}/></button></div></aside>
    <div className="workspace"><header className="topbar"><span>Seu relacionamento vai além do atendimento.</span><div className="topbar-actions">{demo && <span className="demo-label">DEMONSTRAÇÃO</span>}<button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema">{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><button className="icon-button" disabled={loading || demo} onClick={reload} aria-label="Atualizar dados"><RefreshCw size={18} className={loading ? 'spin' : ''}/></button><button className="icon-button" aria-label="Sair" onClick={() => { if (demo) { setDemo(false); setData(empty); setLoaded(false); } else supabase.auth.signOut(); }}><LogOut size={18}/></button></div></header>
    <main>{error && <div className="error" role="alert">{error}<button className="text-button" onClick={reload}>Tentar novamente</button></div>}{notice && <div className="toast" role="status"><Check size={18}/>{notice}</div>}
      <div className="page-heading"><div><p className="eyebrow">{page === 'dashboard' ? 'CUIDAR. ACOMPANHAR. FIDELIZAR.' : 'SEU PÓS-VENDA, ORGANIZADO.'}</p><h1>{page === 'dashboard' ? `Olá, ${data.profile?.full_name?.split(' ')[0] || 'profissional'} 👋` : page === 'clients' ? 'Seus clientes' : page === 'messages' ? 'Central de mensagens' : page === 'invitations' ? 'Acessos e convites' : 'Minha conta'}</h1><p>{page === 'dashboard' ? 'Pequenos contatos. Relacionamentos duradouros.' : page === 'clients' ? 'Cada cliente tem uma história. Acompanhe de perto.' : page === 'messages' ? 'O próximo cuidado começa com uma conversa.' : 'Seu perfil e o WhatsApp usado nos atendimentos.'}</p></div>{!['settings', 'invitations'].includes(page) && <button className="primary" disabled={!loaded} onClick={() => setModal({ type: 'client' })}><Plus size={18}/>Novo cliente</button>}</div>
      {page === 'invitations' && isAdmin ? <AdminInvitations/> : !loaded ? <div className="empty">{loading ? 'Carregando seus dados…' : 'Aguardando a configuração do banco. Atualize para tentar novamente.'}</div> : <>
      {page === 'dashboard' && <><section className="stats-grid"><Stat title="Clientes ativos" value={clients.length} detail="Relacionamentos em construção" icon={Users}/><Stat title="Contatos pendentes" value={pending.length} detail={overdue.length ? `${overdue.length} precisam de atenção` : 'Tudo em dia por aqui'} icon={MessageCircle} accent/><Stat title="Mensagens enviadas" value={sent.length} detail="Confirmadas por você" icon={Check}/><Stat title="Próximos contatos" value={data.messages.filter(m => messageBucket(m) === 'scheduled').length} detail="Programados para os próximos dias" icon={CalendarDays}/></section><section className="focus-banner"><div><span className="eyebrow">O CUIDADO CONTINUA</span><h2>{pending.length ? `${pending.length} conversas esperando por você.` : 'Tudo pronto para o próximo contato.'}</h2><p>{pending.length ? 'Reserve alguns minutos para acompanhar seus clientes.' : 'Cadastre um atendimento e deixe o próximo contato organizado.'}</p><button onClick={() => { navigate('messages'); setTab('pending'); }}>Ver mensagens pendentes<ArrowRight size={18}/></button></div><div className="banner-symbol" aria-hidden="true"><MessageCircle size={100} strokeWidth={1.2}/><span><Heart size={35} fill="currentColor"/></span></div></section><div className="section-head"><div><h2>Na sua lista de hoje <span className="count">{pending.length}</span></h2><p>Um acompanhamento faz toda a diferença.</p></div><button className="text-button" onClick={() => navigate('messages')}>Ver todas<ArrowRight size={16}/></button></div><div className="messages-grid">{pending.sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at)).slice(0, 3).map(m => <MessageCard key={m.id} message={m}/>)}</div>{!pending.length && <Empty text="Nenhum contato pendente. Seus próximos acompanhamentos aparecerão aqui."/>}</>}
      {page === 'messages' && <><div className="queue-note"><ShieldCheck size={18}/>Um acompanhamento pendente por cliente. Novos atendimentos atualizam o prazo.</div><div className="list-toolbar"><div className="tabs">{[['pending', 'Pendentes'], ['scheduled', 'Programadas'], ['history', 'Histórico']].map(([key,label]) => <button className={tab === key ? 'selected' : ''} key={key} onClick={() => setTab(key)}>{label}<span>{data.messages.filter(m => messageBucket(m) === key).length}</span></button>)}</div><SearchField value={query} onChange={setQuery}/></div><div className="messages-grid">{data.messages.filter(m => messageBucket(m) === tab && matches(clientFor(m))).sort((a,b) => tab === 'history' ? (b.sent_at || b.cancelled_at || '').localeCompare(a.sent_at || a.cancelled_at || '') : a.scheduled_at.localeCompare(b.scheduled_at)).map(m => <MessageCard key={m.id} message={m}/>)}</div>{!data.messages.some(m => messageBucket(m) === tab && matches(clientFor(m))) && <Empty text="Nenhuma mensagem nesta lista."/>}<p className="help-note">Abrir uma conversa não confirma o envio. Depois de enviar no WhatsApp, use o botão ✓.</p></>}
      {page === 'clients' && <><div className="list-toolbar"><h2>{clients.length} clientes</h2><SearchField value={query} onChange={setQuery}/></div><div className="client-list">{clients.filter(matches).map(c => { const next = data.messages.find(m => m.client_id === c.id && m.status === 'pending'); return <article className="client-row" key={c.id}><div className="avatar">{c.full_name.slice(0, 1)}</div><button className="client-name" onClick={() => setModal({ type: 'detail', client: c })}><strong>{c.full_name}</strong><small>{c.whatsapp_number}</small></button><div className="next-contact"><small>Próximo contato</small><span>{next ? dateLabel(next.scheduled_at) : 'Sem contato pendente'}</span></div><button className="secondary" onClick={() => setModal({ type: 'appointment', client: c })}><Plus size={16}/>Atendimento</button><button className="icon-button" aria-label={`Ver ficha de ${c.full_name}`} onClick={() => setModal({ type: 'detail', client: c })}><ChevronRight size={18}/></button></article>; })}</div>{!clients.filter(matches).length && <Empty text="Nenhum cliente encontrado. Comece pelo botão Novo cliente."/>}</>}
      {page === 'settings' && <section className="settings-panel"><h2>Seu perfil profissional</h2><ProfileForm profile={data.profile} busy={busy} onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); action(async () => { const profile = { full_name: f.full_name.trim(), whatsapp_number: normalizePhone(f.whatsapp_number) }; if (demo) setData(prev => ({ ...prev, profile })); else { const { error } = await supabase.from('professionals').upsert({ id: session.user.id, ...profile }); if (error) throw error; } }, 'Perfil atualizado.'); }}/><div className="queue-note"><MessageCircle size={20}/><p>Use uma sessão do WhatsApp conectada a este número para enviar. O cadastro do número não conecta o WhatsApp automaticamente.</p></div>{demo && <button className="secondary" onClick={() => { setDemo(false); setData(empty); setLoaded(false); }}>Entrar com minha conta<ArrowRight size={16}/></button>}</section>}
      </>}
      <footer><span><Heart size={13}/> Próxima CRM</span><span>{demo ? 'Demonstração · alterações duram até recarregar a página' : 'Atualização automática a cada 30 segundos'}</span></footer>
    </main></div>
    {modal && <Modal title={{client:'Novo cliente',appointment:'Registrar atendimento',detail:modal.client?.full_name,send:'Confirmar envio',cancel:'Cancelar contato',edit:'Editar mensagem',reschedule:'Reagendar contato'}[modal.type]} onClose={() => { if (!busy) setModal(null); }}>
      {error && <div className="error" role="alert">{error}</div>}
      {['client','appointment'].includes(modal.type) && <form onSubmit={e => submitClient(e, modal.client?.id)}><div className="modal-body">{modal.type === 'client' ? <div className="form-grid"><Field label="Nome do cliente" name="full_name" required maxLength={120} placeholder="Como seu cliente se chama?"/><Field label="WhatsApp com DDD" name="whatsapp_number" type="tel" required placeholder="(11) 99999-9999"/></div> : <p className="subtle">{modal.client.full_name} · O contato pendente anterior será substituído.</p>}<div className="form-grid"><Field label="Serviço (opcional)" name="service" maxLength={2000} placeholder="Ex.: limpeza de pele"/><Field label="Data do atendimento" name="date" type="date" defaultValue={today()} max={today()} required/></div><IntervalField/>{modal.type === 'client' && <details className="anamnesis"><summary>Anamnese <span>Opcional</span></summary><div className="form-grid">{anamnesisFields.map(([key,label]) => <Field key={key} label={label} name={key}/>)}</div></details>}</div><div className="modal-footer"><button type="button" className="secondary" disabled={busy} onClick={() => setModal(null)}>Voltar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar e programar contato'}<Check size={17}/></button></div></form>}
      {modal.type === 'detail' && <ClientDetails client={modal.client} data={data} busy={busy} onAppointment={() => setModal({ type: 'appointment', client: modal.client })} onSave={values => action(async () => { if (demo) setData(prev => ({...prev, anamneses: [...prev.anamneses.filter(a => a.client_id !== modal.client.id), {client_id:modal.client.id,...values}]})); else {const { error } = await supabase.from('client_anamneses').upsert({client_id:modal.client.id,professional_id:session.user.id,...values});if(error)throw error;} }, 'Anamnese atualizada.', false)}/>}
      {['send','cancel'].includes(modal.type) && <div className="modal-body"><p>{modal.type === 'send' ? 'Você já enviou esta mensagem pelo WhatsApp? A confirmação retira o contato da fila de pendências.' : 'Este contato sairá da fila de pendências e ficará registrado como cancelado no histórico.'}</p><div className="modal-footer"><button className="secondary" disabled={busy} onClick={() => setModal(null)}>Voltar</button><button className="primary" disabled={busy} onClick={() => updateMessage(modal.message, modal.type)}>{busy ? 'Salvando…' : modal.type === 'send' ? 'Sim, já enviei' : 'Cancelar contato'}</button></div></div>}
      {modal.type === 'edit' && <form onSubmit={e => {e.preventDefault();updateMessage(modal.message,'edit',{body:new FormData(e.currentTarget).get('body').trim()});}}><div className="modal-body"><Field label="Mensagem"><textarea name="body" defaultValue={modal.message.body} rows={6} required maxLength={4000}/></Field></div><div className="modal-footer"><button className="primary" disabled={busy}>Salvar mensagem</button></div></form>}
      {modal.type === 'reschedule' && <form onSubmit={e => {e.preventDefault();updateMessage(modal.message,'reschedule',{scheduled_at:new FormData(e.currentTarget).get('date')+'T12:00:00.000Z'});}}><div className="modal-body"><Field label="Nova data · contato às 9h (Brasília)" type="date" name="date" min={scheduledDate(today(),1).slice(0,10)} required defaultValue={scheduledDate(today(),1).slice(0,10)}/></div><div className="modal-footer"><button className="primary" disabled={busy}>Reagendar</button></div></form>}
    </Modal>}
  </div>;
}

function Stat({title,value,detail,icon:Icon,accent}) { return <article className={`stat ${accent?'accent':''}`}><div><span>{title}</span><Icon size={18}/></div><strong>{value.toString().padStart(2,'0')}</strong><small>{detail}</small></article>; }
function Empty({text}) { return <div className="empty"><MessageCircle size={28}/><p>{text}</p></div>; }
function SearchField({value,onChange}) { return <label className="search"><Search size={18}/><input aria-label="Buscar por nome ou telefone" placeholder="Buscar cliente…" value={value} onChange={e=>onChange(e.target.value)}/></label>; }
function IntervalField() { const [value,setValue] = useState('15'); return <div className="field"><span>Próximo contato em</span><div className="intervals">{intervals.map(n=><button className={value===String(n)?'chosen':''} key={n} type="button" onClick={()=>setValue(String(n))}>{n} dias</button>)}<button className={value==='custom'?'chosen':''} type="button" onClick={()=>setValue('custom')}>Outro</button></div>{value==='custom'?<input name="interval" aria-label="Intervalo em dias" type="number" min="1" max="3650" required placeholder="Quantidade de dias"/>:<input type="hidden" name="interval" value={value}/>}</div>; }
function ProfileForm({profile,busy,onSubmit}) { return <form onSubmit={onSubmit}><Field label="Nome profissional" name="full_name" defaultValue={profile?.full_name} required maxLength={120}/><Field label="Seu WhatsApp com DDD" name="whatsapp_number" type="tel" defaultValue={profile?.whatsapp_number} placeholder="(11) 99999-9999" required/><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar perfil'}<Check size={17}/></button></form>; }
function ClientDetails({client,data,busy,onAppointment,onSave}) {
  const anamnesis = data.anamneses.find(a=>a.client_id===client.id)||{};
  const appointments = data.appointments.filter(a=>a.client_id===client.id).sort((a,b)=>b.appointment_date.localeCompare(a.appointment_date)||b.created_at.localeCompare(a.created_at));
  return <div className="modal-body"><div className="section-head"><p>{client.whatsapp_number}</p><button className="primary" onClick={onAppointment}><Plus size={16}/>Atendimento</button></div><details className="anamnesis"><summary>Anamnese <span>Opcional</span></summary><form onSubmit={e=>{e.preventDefault();onSave(Object.fromEntries(new FormData(e.currentTarget)));}}><div className="form-grid">{anamnesisFields.map(([key,label])=><Field key={key} label={label} name={key} defaultValue={anamnesis[key]||''}/>)}</div><button className="secondary" disabled={busy}>Salvar anamnese</button></form></details><h3 className="timeline-title">Histórico de atendimentos</h3>{appointments.map(a=><div className="timeline-item" key={a.id}><span className="timeline-dot"/><div><strong>{a.service_description||'Atendimento'}</strong><p>{dateLabel(a.appointment_date)} · retorno em {a.follow_up_interval_days} dias</p></div></div>)}{!appointments.length&&<p>Nenhum atendimento registrado.</p>}</div>;
}
function Auth({error,setError,onDemo}) {
  const [busy,setBusy]=useState(false);
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');
    const f=Object.fromEntries(new FormData(e.currentTarget));
    try {
      if(!supabase)throw new Error('A conexão com sua conta ainda não está configurada. Você pode explorar a demonstração.');
      const {error}=await supabase.auth.signInWithPassword({email:f.email,password:f.password});
      if(error)throw error;
    }catch(e){setError(friendly(e));}finally{setBusy(false);}
  }
  return <div className="auth-page"><Brand/><section className="auth-card"><p className="eyebrow">ACESSO SOMENTE POR CONVITE</p><h1>Bom te ver por aqui.</h1><p>As contas são liberadas pelo administrador da Próxima. Abra seu convite para confirmar o e-mail e definir sua senha pessoal.</p><form onSubmit={submit}><Field label="E-mail" name="email" type="email" autoComplete="email" required/><Field label="Senha" name="password" type="password" autoComplete="current-password" required/>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Aguarde…':'Entrar na minha conta'}<ArrowRight size={18}/></button></form><small className="help-note">Precisa de ajuda com o acesso? Fale com o administrador.</small><div className="auth-divider"><span>Conheça a Próxima</span></div><button className="secondary full-width" onClick={onDemo}>Explorar demonstração<ArrowUpRight size={17}/></button><small className="help-note">Demonstração pública com dados fictícios. Não cria conta nem envia mensagens.</small></section></div>;
}
function PasswordSetup({session,onComplete}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(e) {
    e.preventDefault();setError('');const f=Object.fromEntries(new FormData(e.currentTarget));
    if(f.password!==f.confirmation){setError('As senhas precisam ser iguais.');return;}
    setBusy(true);
    try {
      await accountRequest('initial-password', { password: f.password });
      const {data,error}=await supabase.auth.refreshSession();
      if(error)throw error;
      onComplete(data.user);
    }catch(e){setError(friendly(e));}finally{setBusy(false);}
  }
  return <div className="auth-page"><Brand/><section className="auth-card"><p className="eyebrow">CONCLUA SEU ACESSO</p><h1>Defina sua senha</h1><p>Escolha uma senha para acessar sua conta: {session.user.email}</p><form onSubmit={submit}><Field label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/><Field label="Confirmar senha" name="confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar senha e continuar'}<ArrowRight size={18}/></button></form><button className="text-button auth-switch" disabled={busy} onClick={()=>supabase.auth.signOut()}>Sair</button></section></div>;
}
