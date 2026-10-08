const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const { Booking, Flight, Train, Hotel, Package, User } = require('../models');
const { available } = require('../services/bookingService');
const { cancel } = require('../services/paymentService');
const { qrDataUrl, verifyUrl, ticketPdf } = require('../services/ticketService');
const { auth } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/http');
const { computeTotal, computeBundle, nightsBetween, unitsNeeded, isCancellable, refundAmount } = require('../utils/pricing');
const { mealCost } = require('../utils/meals');
const { resolveCoupon } = require('../utils/coupons');
const audit = require('../utils/audit');

const id24 = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');
const schema = z.object({
  itemType: z.enum(['flight', 'train', 'hotel', 'package', 'bundle']),
  itemId: id24,                                              // flight / train-class / hotel / package (bundle: the transport item)
  hotelId: id24.optional(), transport: z.enum(['flight', 'train']).optional(), // bundle = transport + hotel
  travelers: z.coerce.number().int().min(1).max(9),
  nights: z.coerce.number().int().min(1).max(30).optional(),  // bundle only
  checkIn: z.string().optional(), checkOut: z.string().optional(),
  meal: z.string().trim().max(20).optional(), coupon: z.string().trim().max(20).optional(),
  doctorOptIn: z.boolean().optional(),
  licenseNo: z.string().trim().min(3).max(40).optional(),
});

const view = b => {
  const o = b.toObject ? b.toObject() : b;
  const cancellable = isCancellable(o.status, o.startDate);
  return { ...o, cancellable, refundEstimate: cancellable && o.status === 'CONFIRMED' ? refundAmount(o.total, o.startDate) : 0 };
};
const newId = () => `TB-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);
const MODELS = { flight: Flight, train: Train, hotel: Hotel, package: Package };
const titleOf = (kind, it) => kind === 'flight' ? `${it.airline} ${it.flightNo}: ${it.from} → ${it.to}`
  : kind === 'train' ? `${it.name} (${it.number}) ${it.classCode}: ${it.from} → ${it.to}` : kind === 'hotel' ? it.name : it.title;

// Validates everything + calculates the price. No side effects, so it is used by both /quote and create.
async function prepare(d) {
  const isBundle = d.itemType === 'bundle';
  const kind = isBundle ? (d.transport || 'flight') : d.itemType; // flight | train | hotel | package
  const item = await MODELS[kind].findOne({ _id: d.itemId, active: true });
  if (!item) throw httpError(404, 'Item not found');
  let hotel;
  if (isBundle) {
    if (!d.hotelId) throw httpError(400, 'Hotel is required for a bundle');
    hotel = await Hotel.findOne({ _id: d.hotelId, active: true });
    if (!hotel) throw httpError(404, 'Hotel not found');
  }
  const hasTrip = kind === 'flight' || kind === 'train';
  const units = d.itemType === 'hotel' ? unitsNeeded('hotel', d.travelers) : d.travelers; // hotel: rooms, others: seats/slots
  const hotelUnits = isBundle ? unitsNeeded('hotel', d.travelers) : undefined;

  let startDate, endDate, nights = 1;
  if (hasTrip) {
    startDate = new Date(item.date); startDate.setUTCHours(0, 0, 0, 0);
    if (isBundle) { nights = d.nights || 1; endDate = addDays(startDate, nights); }
  } else {
    startDate = new Date(d.checkIn || '');
    if (isNaN(startDate)) throw httpError(400, 'Check-in date required');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (startDate < today) throw httpError(400, 'Check-in cannot be in the past');
    if (kind === 'hotel') {
      endDate = new Date(d.checkOut || '');
      nights = nightsBetween(startDate, endDate);
      if (isNaN(endDate) || nights < 1 || nights > 30) throw httpError(400, 'Check-out must be 1-30 nights after check-in');
    } else endDate = addDays(startDate, item.durationDays);
  }

  const probe = { itemType: d.itemType, transport: isBundle ? kind : undefined, itemId: item._id, hotelId: hotel && hotel._id, units, hotelUnits, startDate, nights };
  if (!(await available(probe))) throw httpError(409, 'Not enough availability for the selected dates');

  const extra = mealCost(d.meal || '', d.itemType, d.travelers, nights);
  const calc = coupon => (isBundle ? computeBundle({ flight: item, hotel, travelers: d.travelers, nights, extra, coupon })
    : computeTotal({ type: kind, item, travelers: d.travelers, nights, extra, coupon }));
  const pre = calc(null);
  const coupon = resolveCoupon(d.coupon, d.itemType, pre.base - pre.discount + pre.extra);
  const price = coupon ? calc(coupon) : pre;

  const title = isBundle ? `${titleOf(kind, item)} + ${hotel.name} (${nights}N)` : titleOf(kind, item);
  const tripKey = kind === 'flight' ? String(item._id) : kind === 'train' ? item.tripKey : undefined;
  return {
    hasTrip, price, coupon, title, startDate, endDate, nights,
    fields: {
      itemType: d.itemType, itemId: item._id, hotelId: hotel && hotel._id, transport: isBundle ? kind : undefined, tripKey, title,
      travelers: d.travelers, units, hotelUnits, nights, startDate, endDate, total: price.total, discount: price.discount,
      meal: d.meal || undefined, mealCost: extra, couponCode: coupon ? coupon.code : undefined, couponDiscount: price.couponDiscount,
    },
  };
}

router.use(auth);

// Live price preview for the booking form (nothing is saved)
router.post('/quote', wrap(async (req, res) => {
  const p = await prepare(schema.parse(req.body));
  res.json({ ...p.price, title: p.title, nights: p.nights, startDate: p.startDate, endDate: p.endDate, coupon: p.coupon ? p.coupon.code : null });
}));

router.post('/', wrap(async (req, res) => {
  const d = schema.parse(req.body);
  const p = await prepare(d);

  // Doctor opt-in is voluntary, only for trips with a flight/train; needs a licence number (verified later by admin)
  let doctorOptIn = false;
  if (d.doctorOptIn && p.hasTrip) {
    const lic = d.licenseNo || req.user.licenseNo;
    if (!lic) throw httpError(400, 'Medical licence number is required for doctor opt-in');
    if (d.licenseNo && d.licenseNo !== req.user.licenseNo) { req.user.licenseNo = d.licenseNo; req.user.doctorVerified = false; await req.user.save(); }
    doctorOptIn = true;
  }
  const booking = await Booking.create({ ...p.fields, bookingId: newId(), user: req.user._id, doctorOptIn, status: 'DRAFT' });
  audit(req.user, 'BOOKING_CREATED', 'Booking', booking.bookingId, { total: p.price.total, type: d.itemType });
  res.status(201).json(view(booking));
}));

router.get('/', wrap(async (req, res) => {
  const list = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(list.map(view));
}));

// ownership check: users can only see their own bookings (admin can see all)
const own = async (req) => {
  const b = await Booking.findById(req.params.id);
  if (!b || (String(b.user) !== String(req.user._id) && req.user.role !== 'admin')) throw httpError(404, 'Booking not found');
  return b;
};
const confirmedOnly = async req => { const b = await own(req); if (b.status !== 'CONFIRMED') throw httpError(409, 'Ticket is available for confirmed bookings only'); return b; };

router.get('/:id', wrap(async (req, res) => res.json(view(await own(req)))));
router.get('/:id/ticket', wrap(async (req, res) => { const b = await confirmedOnly(req); res.json({ verifyUrl: verifyUrl(b.bookingId), qr: await qrDataUrl(b.bookingId) }); }));
router.get('/:id/ticket.pdf', wrap(async (req, res) => {
  const b = await confirmedOnly(req);
  const owner = await User.findById(b.user);
  const pdf = await ticketPdf(b, owner.name);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ticket-${b.bookingId}.pdf"` }).send(pdf);
}));
router.post('/:id/cancel', wrap(async (req, res) => {
  const b = await own(req);
  if (String(b.user) !== String(req.user._id)) throw httpError(403, 'Only the traveler can cancel');
  if (!isCancellable(b.status, b.startDate)) throw httpError(409, 'This booking can no longer be cancelled');
  res.json(view(await cancel(b, req.user)));
}));
module.exports = router;
