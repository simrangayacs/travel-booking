const router = require('express').Router();
const { z } = require('zod');
const { Review, Booking } = require('../models');
const { auth } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/http');

const schema = z.object({
  targetType: z.enum(['flight', 'train', 'hotel', 'package']), targetId: z.string().regex(/^[a-f\d]{24}$/i),
  rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional(),
});
router.get('/', wrap(async (req, res) => {
  const q = z.object({ targetId: z.string().regex(/^[a-f\d]{24}$/i) }).parse(req.query);
  res.json(await Review.find({ targetId: q.targetId, status: 'APPROVED' }).sort({ createdAt: -1 }).limit(20).populate('user', 'name'));
}));
// only travelers with a CONFIRMED booking can review; goes to moderation queue
router.post('/', auth, wrap(async (req, res) => {
  const d = schema.parse(req.body);
  if (!(await Booking.exists({ user: req.user._id, itemType: d.targetType, itemId: d.targetId, status: 'CONFIRMED' }))) throw httpError(403, 'Only confirmed travelers can review');
  res.status(201).json(await Review.create({ ...d, user: req.user._id }));
}));
module.exports = router;
