import { useEffect, useState } from 'react';
import { useT } from '../i18n';

const icon = c => (c === 0 ? '☀️' : c <= 3 ? '⛅' : c <= 48 ? '🌫️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : '⛈️');

// Helper widgets only - never a source of price/availability (free Open-Meteo API, no key needed)
export function Weather({ lat, lng }) {
  const { t } = useT();
  const [w, setW] = useState(null);
  useEffect(() => {
    setW(null);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=3&timezone=auto`)
      .then(r => r.json()).then(setW).catch(() => setW(null));
  }, [lat, lng]);
  if (!w?.current || !w?.daily) return null;
  return (
    <div className="card widget">
      <h4>{t('weather')}</h4>
      <p className="big">{icon(w.current.weather_code)} {Math.round(w.current.temperature_2m)}°C</p>
      <div className="row small">
        {w.daily.time.map((d, i) => <span key={d}>{new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })} {icon(w.daily.weather_code[i])} {Math.round(w.daily.temperature_2m_min[i])}°–{Math.round(w.daily.temperature_2m_max[i])}°</span>)}
      </div>
    </div>
  );
}

export function Currency() {
  const { t } = useT();
  const [rates, setRates] = useState(null);
  const [amount, setAmount] = useState(10000);
  const [cur, setCur] = useState('USD');
  useEffect(() => { fetch('https://open.er-api.com/v6/latest/INR').then(r => r.json()).then(d => setRates(d.rates)).catch(() => setRates(null)); }, []);
  if (!rates) return null;
  return (
    <div className="card widget">
      <h4>{t('currency')}</h4>
      <div className="row">
        <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
        <span>₹ =</span>
        <select value={cur} onChange={e => setCur(e.target.value)}>{['USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}</select>
      </div>
      <p className="big">{(amount * (rates[cur] || 0)).toFixed(2)} {cur}</p>
    </div>
  );
}
