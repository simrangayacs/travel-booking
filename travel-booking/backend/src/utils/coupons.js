const { httpError } = require('./http');
const COUPONS = {
  WELCOME10: { percent: 10, max: 1000, desc: '10% off, up to ₹1000' },
  TRAIN5: { percent: 5, max: 500, types: ['train'], desc: '5% off train tickets, up to ₹500' },
  HACKATHON15: { percent: 15, max: 1500, minSubtotal: 5000, desc: '15% off orders above ₹5000, up to ₹1500' },
};
function resolveCoupon(code, itemType, subtotal) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const c = COUPONS[key];
  if (!c) throw httpError(400, 'Invalid coupon code');
  if (c.types && !c.types.includes(itemType)) throw httpError(400, 'This coupon is not valid for this booking');
  if (c.minSubtotal && subtotal < c.minSubtotal) throw httpError(400, `Minimum order of ₹${c.minSubtotal} needed for ${key}`);
  return { code: key, ...c };
}
module.exports = { COUPONS, resolveCoupon };
