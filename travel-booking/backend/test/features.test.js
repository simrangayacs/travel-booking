const test = require('node:test');
const assert = require('node:assert');
const { computeBundle } = require('../src/utils/pricing');
const { ticketPdf, qrDataUrl, verifyUrl } = require('../src/services/ticketService');
const { nightsList } = require('../src/services/bookingService');

test('bundle = 10% off flight+hotel, then 5% tax', () => {
  const r = computeBundle({ flight: { price: 4000 }, hotel: { pricePerNight: 2000 }, travelers: 2, nights: 2 });
  assert.deepStrictEqual(r, { base: 12000, discount: 1200, extra: 0, couponDiscount: 0, tax: 540, total: 11340 });
});
test('nightsList gives consecutive UTC nights', () => {
  const n = nightsList('2030-01-01', 3).map(d => d.toISOString().slice(0, 10));
  assert.deepStrictEqual(n, ['2030-01-01', '2030-01-02', '2030-01-03']);
});
test('e-ticket is a real PDF and QR encodes the verify url', async () => {
  const pdf = await ticketPdf({ bookingId: 'TB-1', title: 'IndiGo 6E1: Delhi → Goa', travelers: 2, startDate: new Date(), total: 8400, status: 'CONFIRMED', coach: 'A', seat: 3 }, 'Asha');
  assert.strictEqual(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok((await qrDataUrl('TB-1')).startsWith('data:image/png;base64,'));
  assert.ok(verifyUrl('TB-1').endsWith('/verify/TB-1'));
});

const { mealCost } = require('../src/utils/meals');
const { resolveCoupon } = require('../src/utils/coupons');
const { computeTotal } = require('../src/utils/pricing');
const { trainSeatFor, seatArea } = require('../src/utils/seat');

test('meal add-on: per traveler, breakfast per night, only allowed meals', () => {
  assert.strictEqual(mealCost('veg', 'train', 2), 500);
  assert.strictEqual(mealCost('breakfast', 'hotel', 2, 3), 1800);
  assert.strictEqual(mealCost('', 'train', 2), 0);
  assert.throws(() => mealCost('breakfast', 'train', 1), /not available/);
});
test('coupon: percent with cap, type and minimum rules', () => {
  assert.strictEqual(resolveCoupon('welcome10', 'flight', 1000).code, 'WELCOME10');
  assert.throws(() => resolveCoupon('NOPE', 'flight', 1000), /Invalid/);
  assert.throws(() => resolveCoupon('TRAIN5', 'flight', 1000), /not valid/);
  assert.throws(() => resolveCoupon('HACKATHON15', 'train', 1000), /Minimum/);
  const c = resolveCoupon('WELCOME10', 'flight', 50000);
  const r = computeTotal({ type: 'flight', item: { price: 50000 }, travelers: 1, extra: 500, coupon: c });
  assert.strictEqual(r.couponDiscount, 1000); // capped at 1000, not 5050
  assert.strictEqual(r.total, Math.round((50500 - 1000) * 1.05) );
});
test('train seats: coach per class and rollover', () => {
  assert.deepStrictEqual(trainSeatFor('SL', 0), { coach: 'S1', seat: 1 });
  assert.deepStrictEqual(trainSeatFor('SL', 72), { coach: 'S2', seat: 1 });
  assert.deepStrictEqual(trainSeatFor('3A', 60), { coach: 'B2', seat: 7 });
  assert.strictEqual(seatArea('B2', 7), 'Coach B2, seats 6-10');
});
