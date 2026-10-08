// Smoke tests that need no database: validation + auth guards
const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

let server, base;
test.before(async () => { await new Promise(r => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());
const call = (p, o) => fetch(base + p, o);

test('health', async () => assert.strictEqual((await call('/api/health')).status, 200));
test('register validates input', async () => {
  const r = await call('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'A', email: 'bad', password: '1' }) });
  assert.strictEqual(r.status, 400);
});
test('bookings need login', async () => assert.strictEqual((await call('/api/bookings')).status, 401));
test('admin needs login', async () => assert.strictEqual((await call('/api/admin/reports')).status, 401));
test('search validates destination', async () => assert.strictEqual((await call('/api/search?destination=')).status, 400));
test('webhook rejects bad signature', async () => {
  const r = await call('/api/payments/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'bad' }, body: '{}' });
  assert.strictEqual(r.status, 400);
});
