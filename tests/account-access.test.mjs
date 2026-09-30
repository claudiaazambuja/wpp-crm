import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { authenticate, validatePassword } from '../server/accounts.js';

test('admin authorization comes from verified Auth app metadata', async () => {
  const req = { headers: { authorization: 'Bearer token' } };
  const client = user => ({ auth: { getUser: async () => ({ data: { user } }) } });
  await assert.rejects(authenticate({ headers: {} }, client({}), true), { status: 401 });
  await assert.rejects(authenticate(req, client({ user_metadata: { role: 'admin' } }), true), { status: 403 });
  await assert.rejects(authenticate(req, client({ app_metadata: { role: 'admin', must_change_password: true } }), true), { status: 403 });
  assert.ok(await authenticate(req, client({ app_metadata: { role: 'admin', must_change_password: false } }), true));
  assert.equal(validatePassword('temporary-test-password', 'temporary-test-password'), false);
  assert.equal(validatePassword('long-test-password', 'temporary-test-password'), true);
});

test('initial password gates direct data access and RPCs; metadata cannot bypass it', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`set timezone = 'America/Sao_Paulo'; create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, raw_app_meta_data jsonb, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  for (const file of ['202609290001_initial.sql','202609290002_account_access.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  const id = '11111111-1111-4111-8111-111111111111';
  await db.query("insert into auth.users(id,raw_user_meta_data) values ($1,'{\"password_configured\":true,\"role\":\"admin\"}')", [id]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select public.account_ready() ready')).rows[0].ready,false);
  await assert.rejects(db.query("insert into professionals(id,full_name,whatsapp_number) values ($1,'Test','+5511999999999')",[id]), /row-level security/);
  await assert.rejects(db.query("select create_client('Test','+5511999999998','',current_date,7)"), /Initial password/);
  await assert.rejects(db.query("select update_pending_message($1,'send')",[id]), /Initial password/);
  await assert.rejects(db.query('select * from account_invitations'),/permission denied/);
  await assert.rejects(db.query("select private.create_client('Test','+5511999999998','',current_date,7)"), /permission denied/);
  await db.exec('reset role');
  await db.query("update auth.users set raw_app_meta_data = '{\"must_change_password\":false}' where id=$1",[id]);
  await db.exec('set role authenticated');
  await db.query("insert into professionals(id,full_name,whatsapp_number) values ($1,'Test','+5511999999999')",[id]);
  await db.query("select create_client('Test','+5511999999998','',current_date,7)");
  assert.equal((await db.query('select count(*)::int n from messages')).rows[0].n,1);
  await db.exec('reset role');
  await db.query("update auth.users set raw_app_meta_data = '{\"must_change_password\":true}' where id=$1",[id]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from clients')).rows.length,0);
});
