const httpError = (status, message) => Object.assign(new Error(message), { status });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
module.exports = { httpError, wrap, escapeRegex };
