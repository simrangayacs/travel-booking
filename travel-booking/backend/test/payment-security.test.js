const test = require('node:test');
const assert = require('node:assert');
const { hmac, verifyCheckoutSignature, verifyWebhookSignature } = require('../src/utils/crypto');

test('checkout signature verification', () => {
  const secret = 's3cret';
  const signature = hmac(secret, 'order_1|pay_1');
  assert.ok(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature }, secret));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_2', signature }, secret));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature }, undefined)); // no secret => reject
});
test('webhook signature verification on raw body', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const sig = hmac('whsec', body);
  assert.ok(verifyWebhookSignature(body, sig, 'whsec'));
  assert.ok(!verifyWebhookSignature(Buffer.from('{"event":"x"}'), sig, 'whsec'));
});
