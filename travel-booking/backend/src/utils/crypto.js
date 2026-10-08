const crypto = require('crypto');
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
// Razorpay checkout signature = HMAC_SHA256(order_id|payment_id, key_secret)
const verifyCheckoutSignature = ({ orderId, paymentId, signature }, secret) =>
  !!secret && safeEqual(hmac(secret, `${orderId}|${paymentId}`), signature);
// Webhook signature = HMAC_SHA256(raw body, webhook_secret)
const verifyWebhookSignature = (rawBody, signature, secret) => !!secret && safeEqual(hmac(secret, rawBody), signature);
module.exports = { hmac, safeEqual, verifyCheckoutSignature, verifyWebhookSignature };
