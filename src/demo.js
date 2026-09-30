import { today, scheduledDate } from './domain.js';
const date = today();
const names = ['Mariana Costa', 'Beatriz Almeida', 'Camila Rodrigues', 'Juliana Santos', 'Fernanda Lima'];
export function demoData() {
  const clients = names.map((full_name, i) => ({ id: `demo-${i}`, full_name, whatsapp_number: '+5511000000000', created_at: date, archived_at: null }));
  const appointments = clients.map((c, i) => ({ id: `visit-${i}`, client_id: c.id, service_description: ['Limpeza de pele', 'Design de sobrancelhas', 'Drenagem linfática', 'Peeling facial', 'Massagem relaxante'][i], appointment_date: scheduledDate(date, -16).slice(0, 10), follow_up_interval_days: 15, created_at: new Date().toISOString() }));
  const messages = clients.map((c, i) => ({ id: `msg-${i}`, client_id: c.id, appointment_id: appointments[i].id, body: `Olá, ${c.full_name.split(' ')[0]}! Como você está após o nosso atendimento? Estou por aqui se precisar de alguma orientação.`, scheduled_at: scheduledDate(date, [-2, 0, 0, 7, 15][i]), status: 'pending', created_at: new Date().toISOString() }));
  return { profile: { full_name: 'Ana Oliveira', whatsapp_number: '+5511000000000' }, clients, appointments, messages, anamneses: [] };
}
