const router = require('express').Router();
const { z } = require('zod');
const config = require('../config');
const { Booking, Payment } = require('../models');
const { transition, available } = require('../services/bookingService');
const pay = require('../services/paymentService');
const { auth } = require('../middleware/auth');
const { verifyWebhookSignature } = require('../utils/crypto');
const { wrap, httpError } = require('../utils/http');

router.get('/config', (_req, res) => res.json({ mode: pay.isMock() ? 'mock' : 'razorpay' }));

const ownedBooking = async (req, id) => {
  const b = await Booking.findOne({ _id: id, user: req.user._id });
  if (!b) throw httpError(404, 'Booking not found');
  return b;
};
const ownedOrder = async (req, orderId) => {
  const p = await Payment.findOne({ orderId });
  if (!p) throw httpError(404, 'Unknown order');
  await ownedBooking(req, p.booking);
  return p;
};

router.post('/:bookingId/order', auth, wrap(async (req, res) => {
  let b = await ownedBooking(req, req.params.bookingId);
  if (!['DRAFT', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(b.status)) throw httpError(409, `Cannot pay for a ${b.status} booking`);
  if (!(await available(b))) throw httpError(409, 'Sold out, please choose another option'); // re-checked atomically at confirmation
  if (b.status !== 'PAYMENT_PENDING') b = await transition(b._id, ['DRAFT', 'PAYMENT_FAILED'], 'PAYMENT_PENDING');
  res.json(await pay.createOrder(b));
}));

const verifySchema = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() });
router.post('/verify', auth, wrap(async (req, res) => {
  if (pay.isMock()) throw httpError(400, 'Use sandbox gateway in mock mode');
  const d = verifySchema.parse(req.body);
  await ownedOrder(req, d.orderId);
  if (!pay.verifyCheckout(d)) throw httpError(400, 'Payment signature mismatch');
  res.json(await pay.finalize({ orderId: d.orderId, paymentId: d.paymentId, success: true }));
}));

// Built-in sandbox "gateway" for safe demos (disabled when PAYMENT_MODE=razorpay)
router.post('/mock/complete', auth, wrap(async (req, res) => {
  if (!pay.isMock()) throw httpError(404, 'Not found');
  const d = z.object({ orderId: z.string(), outcome: z.enum(['success', 'failure']) }).parse(req.body);
  await ownedOrder(req, d.orderId);
  res.json(await pay.finalize({ orderId: d.orderId, paymentId: 'mock_pay_' + Date.now(), success: d.outcome === 'success' }));
}));

// Razorpay webhook: needs RAW body for signature verification (mounted before express.json in app.js)
const webhook = wrap(async (req, res) => {
  const raw = req.body; // Buffer
  if (!verifyWebhookSignature(raw, req.headers['x-razorpay-signature'], config.razorpay.webhookSecret)) throw httpError(400, 'Bad signature');
  const evt = JSON.parse(raw.toString('utf8'));
  const entity = evt.payload && evt.payload.payment && evt.payload.payment.entity;
  if (!entity || !entity.order_id) return res.json({ ignored: true });
  const eventId = req.headers['x-razorpay-event-id'];
  try {
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') await pay.finalize({ orderId: entity.order_id, paymentId: entity.id, success: true, eventId });
    else if (evt.event === 'payment.failed') await pay.finalize({ orderId: entity.order_id, paymentId: entity.id, success: false, eventId });
  } catch (e) { if (e.status !== 404) throw e; }
  res.json({ ok: true });
});
module.exports = router;
module.exports.webhook = webhook;
