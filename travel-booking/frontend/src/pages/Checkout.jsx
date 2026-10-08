import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, inr, fmt, download } from '../api';
import { useT } from '../i18n';

const loadRazorpay = () => new Promise((ok, no) => {
  if (window.Razorpay) return ok();
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok; s.onerror = () => no(new Error('Could not load Razorpay'));
  document.body.appendChild(s);
});

export default function Checkout() {
  const { id } = useParams();
  const { t } = useT();
  const [b, setB] = useState(null);
  const [order, setOrder] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/bookings/' + id).then(setB).catch(e => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (b?.status === 'CONFIRMED' && !ticket) api(`/bookings/${id}/ticket`).then(setTicket).catch(() => {}); }, [b?.status, id, ticket]);

  const run = async fn => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); await load(); } };

  const start = () => run(async () => {
    const o = await api(`/payments/${id}/order`, { method: 'POST' });
    setOrder(o);
    if (o.gateway === 'razorpay') {
      await loadRazorpay();
      new window.Razorpay({
        key: o.keyId, amount: o.amount, currency: o.currency, order_id: o.orderId, name: 'TravelBook', description: b.title,
        handler: r => run(() => api('/payments/verify', { method: 'POST', body: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } })),
        modal: { ondismiss: () => load() },
      }).open();
    }
  });
  const mock = outcome => run(() => api('/payments/mock/complete', { method: 'POST', body: { orderId: order.orderId, outcome } }));

  if (!b) return <p className="center">{err || 'Loading…'}</p>;
  const payable = ['DRAFT', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(b.status);

  return (
    <div className="card narrow">
      <h2>{t('checkout_title')}</h2>
      <p><b>{b.title}</b></p>
      <p className="muted">{b.travelers} traveler(s) · {fmt(b.startDate)}{b.endDate ? ` → ${fmt(b.endDate)}` : ''}</p>
      {b.mealCost > 0 && <p className="small">🍽️ Meal add-on: {inr(b.mealCost)}</p>}
      {b.couponDiscount > 0 && <p className="small" style={{ color: 'var(--green)' }}>Coupon {b.couponCode}: −{inr(b.couponDiscount)}</p>}
      {b.discount > 0 && <p className="small" style={{ color: 'var(--green)' }}>Bundle discount applied: −{inr(b.discount)}</p>}
      <p className="price">Total: {inr(b.total)} <span className="small muted">(incl. 5% tax)</span></p>
      <p>Booking ID: <b>{b.bookingId}</b> · Status: <span className={'badge ' + b.status}>{b.status}</span></p>
      {err && <p className="error">{err}</p>}

      {b.status === 'PAYMENT_FAILED' && <p className="error">Payment failed. No money was captured by us — you can try again.</p>}
      {payable && !order && <button className="btn" onClick={start} disabled={busy}>{b.status === 'PAYMENT_FAILED' ? 'Try payment again' : `${t('pay')} ${inr(b.total)}`}</button>}
      {payable && order?.gateway === 'mock' && (
        <div className="sandbox">
          <p><b>Sandbox payment gateway</b> (demo mode — no real money)</p>
          <div className="row"><button className="btn" onClick={() => mock('success')} disabled={busy}>Pay successfully</button><button className="btn danger" onClick={() => mock('failure')} disabled={busy}>Simulate failure</button></div>
        </div>
      )}
      {b.status === 'CONFIRMED' && (
        <div className="ok">
          <h3>✅ {t('confirmed')}</h3>
          <p>Payment verified by our server. Booking ID: <b>{b.bookingId}</b></p>
          {b.coach && <p>Coach <b>{b.coach}</b>, Seat <b>{b.seat}</b></p>}
          {ticket && <div className="qr"><img src={ticket.qr} alt="QR" width="140" height="140" /><p className="small muted">{t('scan_qr')}</p></div>}
          <div className="row">
            <button className="btn" onClick={() => download(`/bookings/${id}/ticket.pdf`, `ticket-${b.bookingId}.pdf`).catch(e => setErr(e.message))}>⬇ {t('ticket')}</button>
            <Link className="btn ghost" to="/bookings">{t('view_bookings')}</Link>
          </div>
        </div>
      )}
      {['REFUND_PENDING', 'REFUNDED'].includes(b.status) && <p className="error">This item sold out while you paid. Your payment is being refunded automatically.</p>}
    </div>
  );
}
