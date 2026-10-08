import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, fmt } from '../api';
import { useT } from '../i18n';

// Public page opened by scanning the e-ticket QR code
export default function Verify() {
  const { bookingId } = useParams();
  const { t } = useT();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/verify/' + bookingId).then(setD).catch(e => setErr(e.message)); }, [bookingId]);
  if (err) return <div className="card narrow"><h2>❌ {t('verify_bad')}</h2><p className="muted">{err}</p></div>;
  if (!d) return <p className="center">Loading…</p>;
  return (
    <div className={'card narrow ' + (d.valid ? 'ok' : 'warn')}>
      <h2>{d.valid ? '✅ ' + t('verify_ok') : '⚠️ ' + t('verify_bad')}</h2>
      <p><b>{d.bookingId}</b> · <span className={'badge ' + d.status}>{d.status}</span></p>
      <p>{d.title}</p>
      <p className="muted">Traveler: {d.name} · {d.travelers} person(s) · {fmt(d.startDate)}{d.coach ? ` · Coach ${d.coach}, Seat ${d.seat}` : ''}</p>
    </div>
  );
}
