module.exports = (err, _req, res, _next) => {
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: err.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') });
  }
  if (err.name === 'CastError' || err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'Already exists' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
