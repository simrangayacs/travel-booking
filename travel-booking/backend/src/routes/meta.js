const router = require('express').Router();
const { MEALS, ALLOWED } = require('../utils/meals');
const { COUPONS } = require('../utils/coupons');
// Public: static options used by the booking form (prices still re-calculated on the server)
router.get('/', (_req, res) => res.json({ meals: MEALS, allowed: ALLOWED, coupons: Object.entries(COUPONS).map(([code, c]) => ({ code, desc: c.desc })) }));
module.exports = router;
