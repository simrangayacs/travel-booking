const test = require('node:test');
const assert = require('node:assert');
const { canTransition } = require('../src/utils/bookingState');
const { seatFor, seatArea } = require('../src/utils/seat');

test('valid booking transitions', () => {
  assert.ok(canTransition('DRAFT', 'PAYMENT_PENDING'));
  assert.ok(canTransition('PAYMENT_PENDING', 'CONFIRMED'));
  assert.ok(canTransition('PAYMENT_FAILED', 'PAYMENT_PENDING'));
  assert.ok(canTransition('CONFIRMED', 'CANCELLED'));
  assert.ok(canTransition('CANCELLED', 'REFUND_PENDING'));
  assert.ok(canTransition('REFUND_PENDING', 'REFUNDED'));
});
test('invalid transitions are rejected', () => {
  assert.ok(!canTransition('DRAFT', 'CONFIRMED'));     // cannot skip payment
  assert.ok(!canTransition('CONFIRMED', 'DRAFT'));
  assert.ok(!canTransition('REFUNDED', 'CONFIRMED'));
  assert.ok(!canTransition('CANCELLED', 'CONFIRMED'));
});
test('seat assignment + coarse seat area (privacy)', () => {
  assert.deepStrictEqual(seatFor(0), { coach: 'A', seat: 1 });
  assert.deepStrictEqual(seatFor(31), { coach: 'B', seat: 2 });
  assert.strictEqual(seatArea('B', 8), 'Coach B, seats 6-10');
});
