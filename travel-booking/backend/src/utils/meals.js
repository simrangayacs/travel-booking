const { httpError } = require('./http');
const MEALS = {
  veg: { label: 'Veg meal', price: 250 }, nonveg: { label: 'Non-veg meal', price: 320 }, jain: { label: 'Jain meal', price: 260 },
  breakfast: { label: 'Breakfast buffet', price: 300, perNight: true },
};
const ALLOWED = { flight: ['veg', 'nonveg', 'jain'], train: ['veg', 'nonveg', 'jain'], hotel: ['breakfast'], package: ['breakfast'], bundle: ['veg', 'nonveg', 'jain', 'breakfast'] };

// Meal price per traveler (breakfast: per traveler per night). Always calculated on the server.
function mealCost(code, itemType, travelers, nights = 1) {
  if (!code) return 0;
  if (!(ALLOWED[itemType] || []).includes(code)) throw httpError(400, 'This meal is not available for this booking');
  const m = MEALS[code];
  return m.price * travelers * (m.perNight ? Math.max(1, nights) : 1);
}
module.exports = { MEALS, ALLOWED, mealCost };
