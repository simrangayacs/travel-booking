import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Emergency() {
  const { user } = useAuth();
  const [flights, setFlights] = useState([]);
  const [mine, setMine] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [sel, setSel] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    try {
      setMine(await api('/emergency/mine'));
      if (user.doctorVerified) setNearby(await api('/emergency/nearby'));
    } catch (e) { setMsg(e.message); }
  }, [user.doctorVerified]);

  useEffect(() => {
    api('/bookings').then(l => { const f = l.filter(b => b.status === 'CONFIRMED' && ['flight', 'train', 'bundle'].includes(b.itemType)); setFlights(f); if (f[0]) setSel(f[0].bookingId); });
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]); // simple polling (no websockets needed)

  const raise = async () => {
    setMsg('');
    try { await api('/emergency', { method: 'POST', body: { bookingId: sel, note: note || undefined } }); setNote(''); setMsg('Alert sent to nearby opted-in medical professionals.'); refresh(); }
    catch (e) { setMsg(e.message); }
  };
  const act = (id, what) => api(`/emergency/${id}/${what}`, { method: 'POST' }).then(refresh).catch(e => setMsg(e.message));

  return (
    <>
      <h2>Emergency Medical Assistance</h2>
      <div className="warn"><b>In a life-threatening emergency call 112 first.</b> This feature only connects you to volunteer verified doctors travelling on the same train or flight until emergency services arrive.</div>
      {msg && <p className="muted">{msg}</p>}

      <div className="card">
        <h3>I need help</h3>
        {flights.length ? (
          <div className="row">
            <select value={sel} onChange={e => setSel(e.target.value)}>{flights.map(b => <option key={b._id} value={b.bookingId}>{b.title} ({b.bookingId})</option>)}</select>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Short note (optional, no personal details)" />
            <button className="btn danger" onClick={raise}>Raise Emergency Medical Alert</button>
          </div>
        ) : <p className="muted">You need a confirmed train or flight booking to use this.</p>}
        {mine.map(a => (
          <div key={a.id} className="row between alert">
            <span><span className={'badge ' + a.status}>{a.status}</span> {a.seatArea}{a.doctor && <> · Dr {a.doctor.name} {a.doctor.verified && <span className="badge CONFIRMED">✔ Verified doctor</span>} is helping</>}</span>
            {a.status !== 'RESOLVED' && <button className="btn ghost sm" onClick={() => act(a.id, 'resolve')}>Mark resolved</button>}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>I am a doctor</h3>
        {user.doctorVerified ? (
          nearby.length ? nearby.map(a => (
            <div key={a.id} className="row between alert">
              <span>🚨 Help needed near <b>{a.seatArea}</b>{a.note && <> — “{a.note}”</>}</span>
              <button className="btn sm" onClick={() => act(a.id, 'accept')}>Accept & assist</button>
            </div>
          )) : <p className="muted">No open alerts on your trips. This page refreshes automatically.</p>
        ) : <p className="muted">Tick “I am a Doctor / Medical Professional” while booking a train or flight and add your licence number. After admin verification you get the badge and can receive alerts.</p>}
      </div>
    </>
  );
}
