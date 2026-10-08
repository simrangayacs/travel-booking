const router = require('express').Router();
const { z } = require('zod');
const { User, Package, Flight, Train, Hotel, Booking, Review, AuditLog } = require('../models');
const { auth, adminOnly } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/http');
const audit = require('../utils/audit');

router.use(auth, adminOnly);
const RES = { packages: Package, flights: Flight, trains: Train, hotels: Hotel };
const model = req => RES[req.params.resource] || (() => { throw httpError(404, 'Unknown resource'); })();

router.get('/reports', wrap(async (_req, res) => {
  const byStatus = await Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$total' } } }]);
  const since = new Date(Date.now() - 13 * 86400000); since.setUTCHours(0, 0, 0, 0);
  const daily = await Booking.aggregate([
    { $match: { status: 'CONFIRMED', createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$total' } } },
    { $sort: { _id: 1 } },
  ]);
  const sum = s => (byStatus.find(x => x._id === s) || { amount: 0, count: 0 });
  res.json({
    byStatus, daily, users: await User.countDocuments({ role: 'user' }),
    confirmedBookings: sum('CONFIRMED').count, revenue: sum('CONFIRMED').amount, refunded: sum('REFUNDED').amount,
  });
}));
router.get('/bookings', wrap(async (_req, res) => res.json(await Booking.find().sort({ createdAt: -1 }).limit(100).populate('user', 'name email'))));
router.get('/audit', wrap(async (_req, res) => res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actor', 'name'))));

// Inventory CRUD (packages / flights / hotels)
router.get('/inventory/:resource', wrap(async (req, res) => res.json(await model(req).find().sort({ createdAt: -1 }).limit(200))));
router.post('/inventory/:resource', wrap(async (req, res) => {
  const doc = await model(req).create(req.body); audit(req.user, 'CREATE', req.params.resource, doc._id); res.status(201).json(doc);
}));
router.put('/inventory/:resource/:id', wrap(async (req, res) => {
  const doc = await model(req).findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!doc) throw httpError(404, 'Not found');
  audit(req.user, 'UPDATE', req.params.resource, doc._id, req.body); res.json(doc);
}));

// Doctor verification (badge)
router.get('/doctors', wrap(async (_req, res) => res.json(await User.find({ licenseNo: { $exists: true, $ne: null } }).select('name email licenseNo doctorVerified'))));
router.patch('/doctors/:id', wrap(async (req, res) => {
  const { verified } = z.object({ verified: z.boolean() }).parse(req.body);
  const u = await User.findByIdAndUpdate(req.params.id, { doctorVerified: verified }, { new: true });
  if (!u) throw httpError(404, 'User not found');
  audit(req.user, verified ? 'DOCTOR_VERIFIED' : 'DOCTOR_UNVERIFIED', 'User', u._id); res.json({ id: u._id, doctorVerified: u.doctorVerified });
}));

// Review moderation
router.get('/reviews', wrap(async (_req, res) => res.json(await Review.find({ status: 'PENDING' }).populate('user', 'name'))));
router.patch('/reviews/:id', wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body);
  const r = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!r) throw httpError(404, 'Not found'); audit(req.user, 'REVIEW_' + status, 'Review', r._id); res.json(r);
}));
module.exports = router;
