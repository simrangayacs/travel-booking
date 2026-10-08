const test = require('node:test');
const assert = require('node:assert');
const { computeTotal, refundAmount, isCancellable, unitsNeeded, nightsBetween } = require('../src/utils/pricing');

test('flight total = price * travelers + 5% tax', () => {
  assert.deepStrictEqual(computeTotal({ type: 'flight', item: { price: 4000 }, travelers: 2 }), { base: 8000, discount: 0, extra: 0, couponDiscount: 0, tax: 400, total: 8400 });
});
test('hotel total uses nights and rooms (2 guests/room)', () => {
  assert.strictEqual(unitsNeeded('hotel', 3), 2);
  assert.strictEqual(computeTotal({ type: 'hotel', item: { pricePerNight: 1000 }, travelers: 3, nights: 2 }).base, 4000);
});
test('nights between dates', () => assert.strictEqual(nightsBetween('2030-01-01', '2030-01-04'), 3));
test('refund policy: 100% >=48h, 50% <48h, 0 after start', () => {
  const now = new Date('2030-01-01T00:00:00Z');
  assert.strictEqual(refundAmount(1000, '2030-01-05T00:00:00Z', now), 1000);
  assert.strictEqual(refundAmount(1000, '2030-01-01T20:00:00Z', now), 500);
  assert.strictEqual(refundAmount(1000, '2029-12-31T00:00:00Z', now), 0);
});
test('cancellation eligibility', () => {
  const now = new Date('2030-01-01T00:00:00Z');
  assert.ok(isCancellable('CONFIRMED', '2030-01-05', now));
  assert.ok(!isCancellable('CONFIRMED', '2029-12-30', now));
  assert.ok(!isCancellable('REFUNDED', '2030-01-05', now));
  assert.ok(isCancellable('PAYMENT_FAILED', '2029-12-30', now));
});
