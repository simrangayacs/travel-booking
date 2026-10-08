const router = require('express').Router();
const { z } = require('zod');
const { Booking, EmergencyAlert } = require('../models');
const { auth } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/http');
const { seatArea } = require('../utils/seat');
const audit = require('../utils/audit');

const TRIP_TYPES = ['flight', 'train', 'bundle'];
const keyOf = b => b.tripKey || String(b.itemId);
router.use(auth);
const doctorOnly = u => { if (!u.doctorVerified) throw httpError(403, 'Only verified medical professionals can respond'); };

// 1) Passenger raises alert (limited info is shared: coach + seat area only)
router.post('/', wrap(async (req, res) => {
  const d = z.object({ bookingId: z.string().min(1), note: z.string().trim().max(200).optional() }).parse(req.body);
  const b = await Booking.findOne({ bookingId: d.bookingId, user: req.user._id });
  if (!b || b.status !== 'CONFIRMED' || !TRIP_TYPES.includes(b.itemType)) throw httpError(400, 'Alerts work for your confirmed train or flight bookings');
  let alert = await EmergencyAlert.findOne({ booking: b._id, status: { $in: ['OPEN', 'ACCEPTED'] } });
  if (!alert) {
    alert = await EmergencyAlert.create({ booking: b._id, raisedBy: req.user._id, itemId: b.itemId, tripKey: keyOf(b), coach: b.coach, seat: b.seat, seatArea: seatArea(b.coach, b.seat), note: d.note });
    audit(req.user, 'EMERGENCY_RAISED', 'EmergencyAlert', alert._id);
  }
  res.status(201).json({ id: alert._id, status: alert.status, seatArea: alert.seatArea });
}));

router.get('/mine', wrap(async (req, res) => {
  const list = await EmergencyAlert.find({ raisedBy: req.user._id }).sort({ createdAt: -1 }).limit(10).populate('acceptedBy', 'name doctorVerified');
  res.json(list.map(a => ({
    id: a._id, status: a.status, seatArea: a.seatArea, createdAt: a.createdAt,
    doctor: a.acceptedBy ? { name: a.acceptedBy.name.split(' ')[0], verified: a.acceptedBy.doctorVerified } : null,
  })));
}));

// 2) Verified + opted-in doctors on the SAME train/flight see open alerts (any coach/class of that trip)
router.get('/nearby', wrap(async (req, res) => {
  doctorOnly(req.user);
  const mine = await Booking.find({ user: req.user._id, status: 'CONFIRMED', itemType: { $in: TRIP_TYPES }, doctorOptIn: true }).select('tripKey itemId');
  const alerts = await EmergencyAlert.find({ tripKey: { $in: mine.map(keyOf) }, status: 'OPEN', raisedBy: { $ne: req.user._id } }).sort({ createdAt: -1 }).lean();
  res.json(alerts.map(a => ({ id: a._id, seatArea: a.seatArea, note: a.note, createdAt: a.createdAt })));
}));

// 3) Doctor accepts (first one wins)
router.post('/:id/accept', wrap(async (req, res) => {
  doctorOnly(req.user);
  const a = await EmergencyAlert.findById(req.params.id);
  if (!a) throw httpError(404, 'Alert not found');
  const eligible = await Booking.exists({ user: req.user._id, tripKey: a.tripKey, status: 'CONFIRMED', doctorOptIn: true });
  if (!eligible) throw httpError(403, 'You are not on this trip');
  const u = await EmergencyAlert.findOneAndUpdate({ _id: a._id, status: 'OPEN' }, { status: 'ACCEPTED', acceptedBy: req.user._id, acceptedAt: new Date() }, { new: true });
  if (!u) throw httpError(409, 'Already accepted by another doctor');
  audit(req.user, 'EMERGENCY_ACCEPTED', 'EmergencyAlert', u._id);
  res.json({ id: u._id, status: u.status, seatArea: u.seatArea, note: u.note });
}));

router.post('/:id/resolve', wrap(async (req, res) => {
  const a = await EmergencyAlert.findById(req.params.id);
  const me = String(req.user._id);
  if (!a || (String(a.raisedBy) !== me && String(a.acceptedBy) !== me)) throw httpError(404, 'Alert not found');
  a.status = 'RESOLVED'; await a.save();
  audit(req.user, 'EMERGENCY_RESOLVED', 'EmergencyAlert', a._id);
  res.json({ id: a._id, status: a.status });
}));
module.exports = router;
