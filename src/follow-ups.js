export const feedbackBody = 'Olá, {nome}! Como você está após o nosso atendimento? Quero saber como foi sua recuperação e se ficou alguma dúvida. Estou por aqui para ajudar.';
export const returnBody = 'Olá, {nome}! Já faz um tempinho desde seu atendimento de {servico}. Vamos agendar uma nova consulta para dar continuidade aos seus cuidados?';

export function parseDays(value) {
  const parts = String(value).trim().split(/[,;\s]+/);
  if (!parts.length || parts.some(n => !/^\d+$/.test(n))) throw new Error('Informe os dias separados por vírgula, como 7, 15 e 60.');
  const days = parts.map(Number);
  if (days.length > 30 || days.some(n => n < 1 || n > 3650) || new Set(days).size !== days.length) throw new Error('Use até 30 dias diferentes, entre 1 e 3650.');
  return days.sort((a, b) => a - b);
}
export function templateSteps(templates) {
  return templates.filter(t => !t.archived_at).flatMap(t => t.days.map(day => ({ key: `${t.id}:${day}`, day, title: t.title, body: t.body }))).sort((a, b) => a.day - b.day);
}
export function renderMessage(body, name, service) {
  return body.replaceAll('{nome}', name).replaceAll('{servico}', service || 'atendimento');
}
export function validateSchedule(steps) {
  if (!steps.length || steps.length > 30) throw new Error('Selecione de 1 a 30 contatos.');
  if (new Set(steps.map(s => s.day)).size !== steps.length) throw new Error('Selecione apenas uma mensagem para cada dia.');
  if (steps.some(s => !Number.isInteger(s.day) || s.day < 1 || s.day > 3650 || !s.body?.trim() || s.body.length > 3000 || !s.title?.trim() || s.title.length > 100)) throw new Error('Confira os dias, nomes e textos das mensagens.');
  return [...steps].sort((a, b) => a.day - b.day);
}
