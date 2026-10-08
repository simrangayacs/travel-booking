const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { User } = require('../models');
const { sign, auth } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/http');
const audit = require('../utils/audit');

const pub = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, doctorVerified: u.doctorVerified, hasLicense: !!u.licenseNo });
const reg = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().email(), password: z.string().min(8).max(72) });
const log = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

router.post('/register', wrap(async (req, res) => {
  const d = reg.parse(req.body);
  if (await User.exists({ email: d.email.toLowerCase() })) throw httpError(409, 'Email already registered');
  const user = await User.create({ name: d.name, email: d.email, passwordHash: await bcrypt.hash(d.password, 10) }); // role always "user"
  audit(user, 'REGISTER', 'User', user._id);
  res.status(201).json({ token: sign(user), user: pub(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const d = log.parse(req.body);
  const user = await User.findOne({ email: d.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(d.password, user.passwordHash))) throw httpError(401, 'Invalid email or password');
  res.json({ token: sign(user), user: pub(user) });
}));

router.get('/me', auth, (req, res) => res.json({ user: pub(req.user) }));
module.exports = router;
module.exports.pub = pub;
