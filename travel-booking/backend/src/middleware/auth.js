const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { httpError, wrap } = require('../utils/http');

const sign = user => jwt.sign({ id: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });

const auth = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw httpError(401, 'Login required');
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); } catch { throw httpError(401, 'Session expired, please login again'); }
  const user = await User.findById(payload.id);
  if (!user) throw httpError(401, 'User not found');
  req.user = user;
  next();
});

const adminOnly = (req, _res, next) => (req.user && req.user.role === 'admin' ? next() : next(httpError(403, 'Admin access only')));
module.exports = { sign, auth, adminOnly };
