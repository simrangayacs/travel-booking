import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr, fmt, download } from '../api';
import { useT } from '../i18n';

function ReviewForm({ b }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const send = async () => {
    try { await api('/reviews', { method: 'POST', body: { targetType: b.itemType, targetId: b.itemId, rating, comment } }); setMsg('Thanks! Your review will appear after moderation.'); setOpen(false); }
    catch (e) { setMsg(e.message); }
  };
  if (msg) return <p className="small muted">{msg}</p>;
  if (!open) return <button className="btn ghost sm" onClick={() => setOpen(true)}>Write review</button>;
  return (
    <div className="row">
      <select value={rating} onChange={e => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}</select>
      <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Your experience" maxLength={500} />
      <button className="btn sm" onClick={send}>Submit</button>
    </div>
  );
}

const ICON = { flight: '✈️', train: '🚆', hotel: '🏨', package: '🎒', bundle: '🧳' };
const left = b => { const d = Math.ceil((new Date(b.startDate) - Date.now()) / 864e5); return b.status === 'CONFIRMED' && d >= 0 ? (d === 0 ? 'Today!' : `in ${d} day${d > 1 ? 's' : ''}`) : null; };

export default function Bookings() {
  const { t } = useT();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/bookings').then(setList).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async b => {
    const note = b.status === 'CONFIRMED' ? `You will get a refund of ${inr(b.refundEstimate)}.` : 'No payment was taken.';
    if (!window.confirm(`Cancel ${b.bookingId}? ${note}`)) return;
    try { await api(`/bookings/${b._id}/cancel`, { method: 'POST' }); load(); } catch (e) { setErr(e.message); }
  };

  if (!list) return <p className="center">{err || 'Loading…'}</p>;
  return (
    <>
      <h2>{t('bookings')}</h2>
      {err && <p className="error">{err}</p>}
      {!list.length && <p className="muted">{t('no_bookings')} <Link to="/">{t('search')}</Link></p>}
      {list.map(b => (
        <div className="card item col" key={b._id}>
          <div className="between">
            <div><h4>{ICON[b.itemType]} {b.title} {left(b) && <span className="badge CONFIRMED">{left(b)}</span>}</h4><p className="muted small">{b.bookingId} · {b.travelers} traveler(s) · {fmt(b.startDate)}{b.endDate ? ` → ${fmt(b.endDate)}` : ''}</p></div>
            <div className="right"><div className="price">{inr(b.total)}</div><span className={'badge ' + b.status}>{b.status}</span></div>
          </div>
          {b.coach && <p className="small">Coach {b.coach}, Seat {b.seat}</p>}
          {b.mealCost > 0 && <p className="small">🍽️ Meal included · {b.meal}</p>}
          {b.refundAmount > 0 && <p className="small">Refund: {inr(b.refundAmount)} ({b.status === 'REFUNDED' ? 'completed' : 'in progress'})</p>}
          <div className="row">
            {['DRAFT', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(b.status) && <Link className="btn sm" to={'/checkout/' + b._id}>{t('continue_pay')}</Link>}
            {b.cancellable && <button className="btn danger sm" onClick={() => cancel(b)}>{t('cancel')}</button>}
            {b.status === 'CONFIRMED' && ['flight', 'train', 'bundle'].includes(b.itemType) && <Link className="btn ghost sm" to="/emergency">Emergency help</Link>}
            {b.status === 'CONFIRMED' && <button className="btn sm" onClick={() => download(`/bookings/${b._id}/ticket.pdf`, `ticket-${b.bookingId}.pdf`).catch(e => setErr(e.message))}>⬇ {t('ticket')}</button>}
            {b.status === 'CONFIRMED' && b.itemType !== 'bundle' && <ReviewForm b={b} />}
          </div>
        </div>
      ))}
    </>
  );
}
