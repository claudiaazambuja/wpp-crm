export function normalizePhone(value) {
  let number = value.replace(/\D/g, '');
  if (number.length === 10 || number.length === 11) number = '55' + number;
  if (!/^55[1-9][0-9][0-9]{8,9}$/.test(number)) throw new Error('Informe um WhatsApp brasileiro com DDD válido.');
  return '+' + number;
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function scheduledDate(date, days) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10) + 'T12:00:00.000Z';
}
export function dateLabel(value) { return new Date(value.length === 10 ? value + 'T12:00:00Z' : value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' }); }
export function messageBucket(message, date = today()) {
  if (message.status !== 'pending') return 'history';
  return message.scheduled_at.slice(0, 10) <= date ? 'pending' : 'scheduled';
}
export function whatsappUrl(phone, body) { return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`; }
