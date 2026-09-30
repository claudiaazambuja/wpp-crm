import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, scheduledDate, messageBucket, whatsappUrl } from '../src/domain.js';
test('Brazilian phone normalization prevents formatting duplicates', () => {
  assert.equal(normalizePhone('(11) 99999-1234'), '+5511999991234');
  assert.equal(normalizePhone('+55 11 99999-1234'), '+5511999991234');
  assert.throws(() => normalizePhone('1234'));
});
test('calendar intervals cross months and leap years at 9am Brasilia', () => {
  assert.equal(scheduledDate('2024-02-28', 2), '2024-03-01T12:00:00.000Z');
  assert.equal(scheduledDate('2026-12-31', 1), '2027-01-01T12:00:00.000Z');
});
test('queue includes overdue and today, while closed messages stay in history', () => {
  assert.equal(messageBucket({status:'pending',scheduled_at:'2026-09-28T12:00:00Z'},'2026-09-29'),'pending');
  assert.equal(messageBucket({status:'pending',scheduled_at:'2026-09-29T12:00:00Z'},'2026-09-29'),'pending');
  assert.equal(messageBucket({status:'pending',scheduled_at:'2026-09-30T12:00:00Z'},'2026-09-29'),'scheduled');
  assert.equal(messageBucket({status:'sent',scheduled_at:'2026-09-30T12:00:00Z'},'2026-09-29'),'history');
});
test('WhatsApp link escapes message content', () => {
  assert.equal(whatsappUrl('+5511999991234','Olá & você?'),'https://wa.me/5511999991234?text=Ol%C3%A1%20%26%20voc%C3%AA%3F');
});
