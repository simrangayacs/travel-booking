import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, inr, fmt } from '../api';
import { useAuth } from '../auth';
import { useT } from '../i18n';
import { Weather, Currency } from '../components/Widgets';

const iso = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const SAVED_KEY = 'tb_saved';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } };
const DESTS = [
  ['Goa', '🏖️', 'Beaches & nightlife'], ['Jaipur', '🏰', 'Forts & palaces'], ['Manali', '🏔️', 'Snow & adventure'],
  ['Kochi', '🌴', 'Backwaters & spice'], ['Varanasi', '🛕', 'Ghats & Ganga aarti'], ['Mumbai', '🌆', 'City that never sleeps'],
];
const MODES = [['flights', '✈️', 'flights'], ['trains', '🚆', 'trains'], ['hotels', '🏨', 'hotels'], ['packages', '🎒', 'packages']];
const trainTitle = x => `${x.name} (${x.number}) ${x.classCode}`;

function MapEmbed({ lat, lng }) {
  const d = 0.05;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d / 1.6},${lng + d},${lat + d / 1.6}&layer=mapnik&marker=${lat},${lng}`;
  return <iframe title="map" className="map" src={src} loading="lazy" />;
}

function Item({ title, sub, meta, price, total, badges = [], saved, onSave, onBook }) {
  const { t } = useT();
  return (
    <div className="card item">
      <div>
        <h4>{title} {badges.map(b => <span key={b} className="badge CONFIRMED">{typeof b === 'string' && b.startsWith('🩺') ? b : t(b)}</span>)}</h4>
        <p className="muted">{sub}</p><p className="small">{meta}</p>
      </div>
      <div className="right">
        <button className="heart" onClick={onSave} aria-label="save">{saved ? '♥' : '♡'}</button>
        <div className="price">{price}</div>
        {total != null && <div className="small muted">{t('est_total')} {inr(total)}</div>}
        <button className="btn sm" onClick={onBook}>{t('book')}</button>
      </div>
    </div>
  );
}

function TrainCard({ g, saved, onSave, onBook }) {
  return (
    <div className="card item col">
      <div className="between">
        <div>
          <h4>🚆 {g.name} <span className="muted small">({g.number})</span> {g.doctorsOnBoard > 0 && <span className="badge CONFIRMED">🩺 {g.doctorsOnBoard} doctor{g.doctorsOnBoard > 1 ? 's' : ''} on board</span>}</h4>
          <p className="muted">{g.from} → {g.to}</p>
          <p className="small">{fmt(g.date)} · {g.departTime} – {g.arriveTime}</p>
        </div>
        <button className="heart" onClick={() => onSave(g.classes[0])} aria-label="save">{saved ? '♥' : '♡'}</button>
      </div>
      <div className="row">
        {g.classes.map(c => (
          <button key={c._id} className="classbtn" onClick={() => onBook(c)}>
            <b>{c.classCode}</b> <span className="muted small">{c.className}</span>
            <span className="price sm">{inr(c.price)}</span><small>{c.seatsAvailable} left</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const [f, setF] = useState({ destination: 'Goa', from: '', checkIn: iso(14), checkOut: iso(17), travelers: 2, budget: '' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const [plan, setPlan] = useState(null);
  const [tab, setTab] = useState('flights');
  const [saved, setSaved] = useState(loadSaved);
  const [meta, setMeta] = useState(null);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);

  const isSaved = id => saved.some(s => s.item._id === id);
  const toggleSave = (type, item) => setSaved(s => {
    const next = s.some(x => x.item._id === item._id) ? s.filter(x => x.item._id !== item._id) : [...s, { type, item }];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    return next;
  });

  const trainGroups = useMemo(() => {
    const m = new Map();
    (res?.trains || []).forEach(x => { if (!m.has(x.tripKey)) m.set(x.tripKey, { ...x, classes: [] }); m.get(x.tripKey).classes.push(x); });
    return [...m.values()].map(g => ({ ...g, classes: g.classes.sort((a, b) => a.price - b.price) }));
  }, [res]);

  const badges = useMemo(() => {
    const b = {};
    if (!res) return b;
    const mark = (list, score, label) => {
      if (list.length < 2) return;
      const best = list.reduce((a, c) => (score(c) < score(a) ? c : a));
      b[best._id] = [...(b[best._id] || []), label];
    };
    mark(res.flights, x => x.estimatedTotal, 'cheapest');
    mark(res.hotels, x => -x.rating, 'top_rated'); mark(res.hotels, x => x.estimatedTotal, 'best_value');
    mark(res.packages, x => -x.rating, 'top_rated');
    res.flights.forEach(x => { if (x.doctorsOnBoard > 0) b[x._id] = [...(b[x._id] || []), `🩺 ${x.doctorsOnBoard} doctor(s) on board`]; });
    return b;
  }, [res]);

  const doSearch = async form => {
    setErr(''); setLoading(true); setSel(null); setPlan(null);
    try {
      const p = new URLSearchParams({ destination: form.destination, travelers: form.travelers, checkIn: form.checkIn, checkOut: form.checkOut });
      if (form.budget) p.set('budget', form.budget);
      if (form.from) p.set('from', form.from);
      setRes(await api('/search?' + p));
    } catch (x) { setErr(x.message); setRes(null); } finally { setLoading(false); }
  };
  const submit = e => { e.preventDefault(); doSearch(f); };
  const pickDest = name => { const nf = { ...f, destination: name }; setF(nf); doSearch(nf); };
  const book = (type, item) => { if (!user) return nav('/login', { state: { from: '/' } }); setSel({ type, item }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const aiPlan = async () => {
    if (!user) return nav('/login', { state: { from: '/' } });
    setPlan({ text: 'Planning…' });
    try { setPlan(await api('/itinerary', { method: 'POST', body: { destination: f.destination, days: Math.max(1, res?.nights || 3) } })); }
    catch (x) { setPlan({ text: x.message }); }
  };

  const renderItem = (type, x, withTotal = true) => {
    const common = { badges: badges[x._id], saved: isSaved(x._id), onSave: () => toggleSave(type, x), onBook: () => book(type, x), total: withTotal ? x.estimatedTotal : undefined };
    if (type === 'flight') return <Item key={x._id} {...common} title={`✈️ ${x.airline} ${x.flightNo}`} sub={`${x.from} → ${x.to}`} meta={`${fmt(x.date)} · ${x.departTime} – ${x.arriveTime} · ${x.seatsAvailable} seats left`} price={`${inr(x.price)} ${t('per_person')}`} />;
    if (type === 'train') return <Item key={x._id} {...common} title={`🚆 ${trainTitle(x)}`} sub={`${x.from} → ${x.to}`} meta={`${fmt(x.date)} · ${x.departTime} – ${x.arriveTime}`} price={`${inr(x.price)} ${t('per_person')}`} />;
    if (type === 'hotel') return <Item key={x._id} {...common} title={`🏨 ${x.name}`} sub={`★ ${x.rating} · ${x.amenities?.join(', ')}`} meta={`${x.roomsAvailable} rooms left (selected dates) · ${res?.nights || 1} night(s)`} price={`${inr(x.price ?? x.pricePerNight)} ${t('per_night')}`} />;
    return <Item key={x._id} {...common} title={`🎒 ${x.title}`} sub={`★ ${x.rating} · ${x.durationDays} days`} meta={x.description} price={`${inr(x.price)} ${t('per_person')}`} />;
  };
  const TABS = [['flights', t('flights'), res?.flights.length], ['trains', t('trains'), trainGroups.length], ['hotels', t('hotels'), res?.hotels.length], ['packages', t('packages'), res?.packages.length], ['saved', t('saved'), saved.length]];

  return (
    <>
      <section className="hero">
        <h1>{t('hero')}</h1>
        <p>{t('hero_sub')}</p>
        <div className="modes">{MODES.map(([k, ic, lab]) => <button key={k} type="button" className={'mode ' + (tab === k ? 'on' : '')} onClick={() => setTab(k)}>{ic} {t(lab)}</button>)}</div>
        <form className="search" onSubmit={submit}>
          <label>{t('from')}<input value={f.from} onChange={set('from')} placeholder="Gaya, Patna, Delhi…" /></label>
          <label>{t('destination')}<input value={f.destination} onChange={set('destination')} required minLength={2} placeholder="Goa, Jaipur, Manali…" /></label>
          <label>{t('checkin')}<input type="date" value={f.checkIn} onChange={set('checkIn')} min={iso(0)} /></label>
          <label>{t('checkout')}<input type="date" value={f.checkOut} onChange={set('checkOut')} min={f.checkIn} /></label>
          <label>{t('travelers')}<input type="number" min="1" max="9" value={f.travelers} onChange={set('travelers')} /></label>
          <label>{t('budget')}<input type="number" min="1" value={f.budget} onChange={set('budget')} placeholder={t('optional')} /></label>
          <button className="btn" disabled={loading}>{loading ? t('searching') : t('search')}</button>
        </form>
      </section>

      {err && <p className="error center">{err}</p>}
      {sel && <BookingPanel sel={sel} form={f} meta={meta} hotels={res?.hotels || []} nights={res?.nights || 1} onClose={() => setSel(null)} />}

      {!res && (
        <>
          <h3 className="sec">{t('popular')}</h3>
          <div className="dests">{DESTS.map(([n, ic, tag], i) => (
            <button key={n} className={'dest d' + i} onClick={() => pickDest(n)}><span className="em">{ic}</span><b>{n}</b><small>{tag}</small></button>
          ))}</div>
          <h3 className="sec">{t('why')}</h3>
          <div className="why">
            <div className="card"><span className="em">🔒</span><b>Server-verified payments</b><p className="small muted">Signature-checked, idempotent, no double bookings.</p></div>
            <div className="card"><span className="em">🩺</span><b>Doctor-on-board safety</b><p className="small muted">Opt-in verified doctors on your train or flight can help in an emergency.</p></div>
            <div className="card"><span className="em">🎟️</span><b>QR e-tickets</b><p className="small muted">Download PDF, scan QR to verify instantly.</p></div>
            <div className="card"><span className="em">🍽️</span><b>Meals, bundles & coupons</b><p className="small muted">Add meals, save 10% on transport + hotel bundles.</p></div>
          </div>
        </>
      )}

      {res && (
        <div className="cols">
          <div>
            <div className="row tabs">
              {TABS.map(([k, label, n]) => <button key={k} type="button" className={'btn sm ' + (tab === k ? '' : 'ghost')} onClick={() => setTab(k)}>{label} ({n})</button>)}
            </div>
            {tab === 'flights' && (res.flights.length ? res.flights.map(x => renderItem('flight', x)) : <p className="muted">No flights match.</p>)}
            {tab === 'trains' && (trainGroups.length ? trainGroups.map(g => <TrainCard key={g.tripKey} g={g} saved={isSaved(g.classes[0]._id)} onSave={c => toggleSave('train', c)} onBook={c => book('train', c)} />) : <p className="muted">No trains match. Try a different "From" or leave it empty.</p>)}
            {tab === 'hotels' && (res.hotels.length ? res.hotels.map(x => renderItem('hotel', x)) : <p className="muted">No hotels match for these dates/budget.</p>)}
            {tab === 'packages' && (res.packages.length ? res.packages.map(x => renderItem('package', x)) : <p className="muted">No packages match.</p>)}
            {tab === 'saved' && (saved.length ? saved.map(s => renderItem(s.type, s.item, false)) : <p className="muted">{t('no_saved')}</p>)}
          </div>
          <aside>
            {res.map && <MapEmbed {...res.map} />}
            {res.map && <Weather {...res.map} />}
            <button className="btn ghost full" onClick={aiPlan}>{t('ai_plan')}</button>
            {plan && <div className="card plan">{plan.source === 'template' && <p className="small muted">Template itinerary (AI key not configured)</p>}<pre>{plan.text}</pre></div>}
            <Currency />
            <p className="small muted">Prices & availability always come from our server. AI, weather, currency and maps are only helpers.</p>
          </aside>
        </div>
      )}
    </>
  );
}

function BookingPanel({ sel, form, meta, hotels, nights, onClose }) {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const { t } = useT();
  const { type, item } = sel;
  const hasTrip = type === 'flight' || type === 'train';
  const [travelers, setTravelers] = useState(form.travelers);
  const [doctor, setDoctor] = useState(false);
  const [lic, setLic] = useState('');
  const [bundle, setBundle] = useState(false);
  const [hotelId, setHotelId] = useState(hotels[0]?._id || '');
  const [meal, setMeal] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState(null);
  const [qErr, setQErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const itemType = hasTrip && bundle && hotelId ? 'bundle' : type;
  const title = type === 'flight' ? `${item.airline} ${item.flightNo}` : type === 'train' ? trainTitle(item) : item.name || item.title;
  const mealOpts = (meta?.allowed?.[itemType] || []).map(code => ({ code, ...meta.meals[code] }));

  const payload = () => ({
    itemType, itemId: item._id, travelers: Number(travelers), checkIn: form.checkIn, checkOut: form.checkOut,
    ...(itemType === 'bundle' ? { transport: type, hotelId, nights } : {}), ...(meal ? { meal } : {}), ...(coupon ? { coupon } : {}),
  });

  useEffect(() => { if (meal && !mealOpts.some(m => m.code === meal)) setMeal(''); }, [itemType]); // eslint-disable-line
  // live price from the server (the server is the only source of truth for money)
  useEffect(() => {
    const h = setTimeout(() => {
      api('/bookings/quote', { method: 'POST', body: payload() }).then(q => { setQuote(q); setQErr(''); }).catch(e => { setQuote(null); setQErr(e.message); });
    }, 300);
    return () => clearTimeout(h);
  }, [travelers, meal, coupon, bundle, hotelId]); // eslint-disable-line

  const go = async () => {
    setErr(''); setBusy(true);
    try {
      const body = payload();
      if (hasTrip && doctor) { body.doctorOptIn = true; if (lic) body.licenseNo = lic; }
      const b = await api('/bookings', { method: 'POST', body });
      if (lic) setUser({ ...user, hasLicense: true });
      nav('/checkout/' + b._id);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const line = (label, val, cls) => val ? <div className={'qline ' + (cls || '')}><span>{label}</span><span>{cls === 'neg' ? '−' : ''}{inr(val)}</span></div> : null;

  return (
    <div className="card panel">
      <h3>{t('book')}: {title}</h3>
      <div className="row">
        <label>{t('travelers')}<input type="number" min="1" max="9" value={travelers} onChange={e => setTravelers(e.target.value)} /></label>
        {!hasTrip && <p className="muted">{fmt(form.checkIn)}{type === 'hotel' ? ` → ${fmt(form.checkOut)}` : ''}</p>}
      </div>

      {hasTrip && hotels.length > 0 && (
        <div className="optin">
          <label className="check"><input type="checkbox" checked={bundle} onChange={e => setBundle(e.target.checked)} /> {t('bundle_add')}</label>
          {bundle && (
            <label>Hotel ({nights} night(s) from travel date)
              <select value={hotelId} onChange={e => setHotelId(e.target.value)}>{hotels.map(h => <option key={h._id} value={h._id}>{h.name} · {inr(h.pricePerNight)}/night</option>)}</select>
            </label>
          )}
        </div>
      )}

      {mealOpts.length > 0 && (
        <label>🍽️ {t('meal')}
          <select value={meal} onChange={e => setMeal(e.target.value)}>
            <option value="">No meal</option>
            {mealOpts.map(m => <option key={m.code} value={m.code}>{m.label} · {inr(m.price)}{m.perNight ? ' / person / night' : ' / person'}</option>)}
          </select>
        </label>
      )}

      <div>
        <label>🏷️ {t('coupon')}</label>
        <div className="row">
          <input value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" maxLength={20} />
          <button type="button" className="btn sm" onClick={() => setCoupon(couponInput)}>{t('apply')}</button>
          {coupon && <button type="button" className="btn ghost sm" onClick={() => { setCoupon(''); setCouponInput(''); }}>✕</button>}
        </div>
        <div className="row small">{(meta?.coupons || []).map(c => <button key={c.code} type="button" className="chip" title={c.desc} onClick={() => { setCouponInput(c.code); setCoupon(c.code); }}>{c.code}</button>)}</div>
      </div>

      {hasTrip && (
        <div className="optin">
          <label className="check"><input type="checkbox" checked={doctor} onChange={e => setDoctor(e.target.checked)} /> I am a Doctor / Medical Professional (optional)</label>
          <p className="small muted">Voluntary opt-in: if a co-passenger on this {type} has a medical emergency you may be alerted. Verified professionals get a badge. Supports, never replaces, emergency services.</p>
          {doctor && !user.hasLicense && <label>Medical licence number<input value={lic} onChange={e => setLic(e.target.value)} minLength={3} placeholder="e.g. MCI-12345" /></label>}
        </div>
      )}

      <div className="quote">
        {quote ? (
          <>
            {line('Fare', quote.base)}{line('Bundle discount', quote.discount, 'neg')}{line('Meals', quote.extra)}{line(`Coupon ${quote.coupon || ''}`, quote.couponDiscount, 'neg')}{line('GST 5%', quote.tax)}
            <div className="qline total"><span>{t('total')}</span><span>{inr(quote.total)}</span></div>
          </>
        ) : <p className={qErr ? 'error' : 'muted'}>{qErr || 'Calculating price…'}</p>}
      </div>
      {err && <p className="error">{err}</p>}
      <div className="row"><button className="btn" onClick={go} disabled={busy || !quote}>{busy ? '…' : t('continue_checkout')}</button><button className="btn ghost" onClick={onClose}>{t('cancel')}</button></div>
    </div>
  );
}
