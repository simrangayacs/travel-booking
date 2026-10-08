// STRETCH feature: AI trip planner. Only a helper - never a source of price/availability/payment truth.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const config = require('../config');
const { auth } = require('../middleware/auth');
const { wrap } = require('../utils/http');

const schema = z.object({ destination: z.string().trim().min(2).max(60), days: z.coerce.number().int().min(1).max(10).default(3), budget: z.coerce.number().positive().optional() });

const fallback = ({ destination, days }) => Array.from({ length: days }, (_, i) =>
  `Day ${i + 1}: Morning - top sights in ${destination}; Afternoon - local food trail; Evening - market walk and sunset spot.`).join('\n');

router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, limit: 15 }), auth, wrap(async (req, res) => {
  const d = schema.parse(req.body);
  if (!config.anthropicKey) return res.json({ source: 'template', text: fallback(d) });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: config.itineraryModel, max_tokens: 900,
        messages: [{ role: 'user', content: `Create a concise ${d.days}-day travel itinerary for ${d.destination}, India${d.budget ? ` for a total budget of about INR ${d.budget}` : ''}. Plain text, one short paragraph per day. Do not quote prices or availability.` }],
      }),
    });
    if (!r.ok) throw new Error('AI error ' + r.status);
    const data = await r.json();
    res.json({ source: 'ai', text: data.content.filter(b => b.type === 'text').map(b => b.text).join('\n') });
  } catch (e) {
    console.error(e.message);
    res.json({ source: 'template', text: fallback(d) }); // demo never breaks
  }
}));
module.exports = router;
