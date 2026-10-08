const crypto = require('crypto');
const config = require('../config');
const { Booking, Payment } = require('../models');
const { transition, reserve, release, assignSeat } = require('./bookingService');
const { verifyCheckoutSignature } = require('../utils/crypto');
const { refundAmount } = require('../utils/pricing');
const { httpError } = require('../utils/http');
const audit = require('../utils/audit');
const { sendConfirmation, sendCancellation } = require('./mailService');
const mailFail = e => console.error('email failed:', e.message);

const isMock = () => config.paymentMode !== 'razorpay';
let rzp;
const client = () => {
  if (!rzp) {
    const Razorpay = require('razorpay');
    rzp = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return rzp;
};

// Reuse the open order of a booking (Razorpay allows retries on the same order)
async function createOrder(booking) {
  const existing = await Payment.findOne({ booking: booking._id, status: 'CREATED' });
  if (existing) return view(existing, booking);
  const amount = booking.total * 100; // paise
  let orderId;
  if (isMock()) orderId = 'mock_order_' + crypto.randomBytes(6).toString('hex');
  else orderId = (await client().orders.create({ amount, currency: booking.currency, receipt: booking.bookingId })).id;
  const p = await Payment.create({ booking: booking._id, gateway: isMock() ? 'mock' : 'razorpay', orderId, amount });
  return view(p, booking);
}
const view = (p, b) => ({ gateway: p.gateway, orderId: p.orderId, amount: p.amount, currency: b.currency, keyId: isMock() ? null : config.razorpay.keyId });

const updateFor = (set, eventId) => ({ $set: set, ...(eventId ? { $addToSet: { eventIds: eventId } } : {}) });

// Single entry point used by checkout verify, mock gateway AND webhook -> idempotent
async function finalize({ orderId, paymentId, success, eventId }) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) throw httpError(404, 'Unknown order');
  const booking = await Booking.findById(payment.booking);
  if (eventId && payment.eventIds.includes(eventId)) return booking; // duplicate webhook

  if (!success) {
    // keep payment CREATED so the user can retry on the same order
    if (eventId) await Payment.updateOne({ _id: payment._id }, { $addToSet: { eventIds: eventId } });
    try { await transition(booking._id, 'PAYMENT_PENDING', 'PAYMENT_FAILED'); } catch { /* already moved on */ }
    audit(booking.user, 'PAYMENT_FAILED', 'Booking', booking.bookingId);
    return Booking.findById(booking._id);
  }

  const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: 'CREATED' }, updateFor({ status: 'PAID', paymentId }, eventId), { new: true });
  if (!claimed) return booking; // already processed -> no double confirmation

  // user cancelled while the payment window was still open -> money captured but booking is dead: refund fully
  if (!['PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(booking.status)) {
    if (booking.status === 'CANCELLED') { await transition(booking._id, 'CANCELLED', 'REFUND_PENDING'); await refund(claimed, booking, booking.total); }
    return Booking.findById(booking._id);
  }

  const reserved = await reserve(booking); // availability re-check at confirmation time
  if (!reserved) {
    await transition(booking._id, ['PAYMENT_PENDING', 'PAYMENT_FAILED'], 'REFUND_PENDING');
    await refund(claimed, booking, booking.total);
    audit(booking.user, 'SOLD_OUT_REFUND', 'Booking', booking.bookingId);
    return Booking.findById(booking._id);
  }
  const seat = await assignSeat(booking);
  const confirmed = await transition(booking._id, ['PAYMENT_PENDING', 'PAYMENT_FAILED'], 'CONFIRMED', seat);
  audit(booking.user, 'BOOKING_CONFIRMED', 'Booking', booking.bookingId, { paymentId });
  sendConfirmation(confirmed).catch(mailFail);
  return confirmed;
}

// Moves REFUND_PENDING -> REFUNDED when gateway accepts. If gateway fails it stays REFUND_PENDING (admin can retry)
async function refund(payment, booking, amountRupees) {
  try {
    let refundId;
    if (payment.gateway === 'mock') refundId = 'mock_refund_' + crypto.randomBytes(5).toString('hex');
    else refundId = (await client().payments.refund(payment.paymentId, { amount: amountRupees * 100 })).id;
    await Payment.updateOne({ _id: payment._id }, { status: 'REFUNDED', refundId });
    await transition(booking._id, 'REFUND_PENDING', 'REFUNDED');
  } catch (e) { console.error('refund failed:', e.message); }
}

async function cancel(booking, actor) {
  const wasConfirmed = booking.status === 'CONFIRMED';
  const amount = wasConfirmed ? refundAmount(booking.total, booking.startDate) : 0;
  const cancelled = await transition(booking._id, booking.status, 'CANCELLED', { refundAmount: amount });
  if (wasConfirmed) {
    await release(cancelled);
    if (amount > 0) {
      const payment = await Payment.findOne({ booking: booking._id, status: 'PAID' });
      if (payment) { await transition(booking._id, 'CANCELLED', 'REFUND_PENDING'); await refund(payment, booking, amount); }
    }
  }
  audit(actor, 'BOOKING_CANCELLED', 'Booking', booking.bookingId, { refund: amount });
  sendCancellation(cancelled, amount).catch(mailFail);
  return Booking.findById(booking._id);
}

const verifyCheckout = (body) => verifyCheckoutSignature(body, config.razorpay.keySecret);
module.exports = { isMock, createOrder, finalize, cancel, verifyCheckout };
