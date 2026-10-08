import { useCallback, useEffect, useState } from 'react';
import { api, inr, fmt } from '../api';

const CFG = {
  packages: { price: 'price', stock: 'slotsAvailable', name: r => `${r.title} (${r.destination})`,
    fields: [['title'], ['destination'], ['price', 'number'], ['durationDays', 'number'], ['slotsAvailable', 'number'], ['lat', 'number'], ['lng', 'number'], ['description']] },
  flights: { price: 'price', stock: 'seatsAvailable', name: r => `${r.airline} ${r.flightNo} ${r.from}→${r.to} · ${fmt(r.date)}`,
    fields: [['from'], ['to'], ['airline'], ['flightNo'], ['date', 'date'], ['departTime'], ['arriveTime'], ['price', 'number'], ['seatsAvailable', 'number']] },
  trains: { price: 'price', stock: 'seatsAvailable', name: r => `${r.name} ${r.number} ${r.classCode} ${r.from}→${r.to} · ${fmt(r.date)}`,
    fields: [['name'], ['number'], ['from'], ['to'], ['date', 'date'], ['departTime'], ['arriveTime'], ['classCode'], ['className'], ['price', 'number'], ['seatsAvailable', 'number']] },
  hotels: { price: 'pricePerNight', stock: 'roomsAvailable', name: r => `${r.name} (${r.city})`,
    fields: [['name'], ['city'], ['pricePerNight', 'number'], ['roomsAvailable', 'number'], ['rating', 'number'], ['lat', 'number'], ['lng', 'number']] },
};

function useLoad(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(path).then(setData).catch(e => setErr(e.message)), [path]);
  useEffect(() => { setData(null); load(); }, [load]);
  return [data, load, err];
}

function BarChart({ title, data, money }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const W = 560, H = 150, bw = W / data.length;
  return (
    <div className="card">
      <h4>{title}</h4>
      <svg viewBox={`0 0 ${W} ${H + 28}`} width="100%" role="img" aria-label={title}>
        {data.map((d, i) => {
          const h = (d.value / max) * H;
          return (
            <g key={d.label}>
              <rect x={i * bw + 4} y={H - h} width={bw - 8} height={h} rx="4" fill="#0f6fb5"><title>{d.label}: {money ? inr(d.value) : d.value}</title></rect>
              <text x={i * bw + bw / 2} y={H + 16} fontSize="10" textAnchor="middle" fill="#5b6f82">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Reports() {
  const [r] = useLoad('/admin/reports');
  if (!r) return <p>Loading…</p>;
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const byDay = Object.fromEntries(r.daily.map(d => [d._id, d]));
  return (
    <>
      <div className="stats">
        <div className="card"><h4>Travelers</h4><div className="price">{r.users}</div></div>
        <div className="card"><h4>Confirmed bookings</h4><div className="price">{r.confirmedBookings}</div></div>
        <div className="card"><h4>Revenue</h4><div className="price">{inr(r.revenue)}</div></div>
        <div className="card"><h4>Refunded</h4><div className="price">{inr(r.refunded)}</div></div>
      </div>
      <BarChart title="Revenue - last 14 days (confirmed)" money data={days.map(d => ({ label: d.slice(5), value: byDay[d]?.amount || 0 }))} />
      <BarChart title="Bookings by status" data={r.byStatus.map(s => ({ label: s._id.replace('_', ' ').slice(0, 9), value: s.count }))} />
      <table><thead><tr><th>Status</th><th>Bookings</th><th>Amount</th></tr></thead>
        <tbody>{r.byStatus.map(s => <tr key={s._id}><td><span className={'badge ' + s._id}>{s._id}</span></td><td>{s.count}</td><td>{inr(s.amount)}</td></tr>)}</tbody></table>
    </>
  );
}

function Row({ res, row, onSaved }) {
  const c = CFG[res];
  const [price, setPrice] = useState(row[c.price]);
  const [stock, setStock] = useState(row[c.stock]);
  const save = async body => { await api(`/admin/inventory/${res}/${row._id}`, { method: 'PUT', body }); onSaved(); };
  return (
    <tr className={row.active ? '' : 'off'}>
      <td>{c.name(row)}</td>
      <td><input type="number" value={price} onChange={e => setPrice(e.target.value)} /></td>
      <td><input type="number" value={stock} onChange={e => setStock(e.target.value)} /></td>
      <td className="row">
        <button className="btn sm" onClick={() => save({ [c.price]: Number(price), [c.stock]: Number(stock) })}>Save</button>
        <button className="btn ghost sm" onClick={() => save({ active: !row.active })}>{row.active ? 'Disable' : 'Enable'}</button>
      </td>
    </tr>
  );
}

function Inventory() {
  const [res, setRes] = useState('packages');
  const [rows, reload, err] = useLoad(`/admin/inventory/${res}`);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const c = CFG[res];
  useEffect(() => setForm({}), [res]);
  const add = async e => {
    e.preventDefault(); setMsg('');
    const body = {}; c.fields.forEach(([k, t]) => { if (form[k] !== undefined && form[k] !== '') body[k] = t === 'number' ? Number(form[k]) : form[k]; });
    try { await api(`/admin/inventory/${res}`, { method: 'POST', body }); setForm({}); reload(); } catch (x) { setMsg(x.message); }
  };
  return (
    <>
      <div className="row">{Object.keys(CFG).map(k => <button key={k} className={'btn sm ' + (k === res ? '' : 'ghost')} onClick={() => setRes(k)}>{k}</button>)}</div>
      {err && <p className="error">{err}</p>}
      <table><thead><tr><th>Item</th><th>{c.price}</th><th>{c.stock}</th><th></th></tr></thead>
        <tbody>{rows?.map(r => <Row key={r._id + r.updatedAt} res={res} row={r} onSaved={reload} />)}</tbody></table>
      <form className="card grid" onSubmit={add}>
        <h4 className="span">Add new {res.slice(0, -1)}</h4>
        {c.fields.map(([k, t]) => <label key={k}>{k}<input type={t || 'text'} value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>)}
        {msg && <p className="error span">{msg}</p>}
        <button className="btn span">Add</button>
      </form>
    </>
  );
}

function Bookings() {
  const [rows] = useLoad('/admin/bookings');
  if (!rows) return <p>Loading…</p>;
  return (
    <table><thead><tr><th>ID</th><th>Traveler</th><th>Item</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>{rows.map(b => <tr key={b._id}><td>{b.bookingId}</td><td>{b.user?.name}<br /><span className="small muted">{b.user?.email}</span></td><td>{b.title}</td><td>{inr(b.total)}</td><td><span className={'badge ' + b.status}>{b.status}</span></td></tr>)}</tbody></table>
  );
}

function Doctors() {
  const [rows, reload] = useLoad('/admin/doctors');
  const set = (id, verified) => api('/admin/doctors/' + id, { method: 'PATCH', body: { verified } }).then(reload);
  if (!rows) return <p>Loading…</p>;
  return (
    <>
      <p className="muted">Check licence numbers with the medical council before verifying.</p>
      <table><thead><tr><th>Name</th><th>Email</th><th>Licence</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(u => <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td>{u.licenseNo}</td>
          <td>{u.doctorVerified ? <span className="badge CONFIRMED">✔ Verified</span> : <span className="badge PAYMENT_PENDING">Pending</span>}</td>
          <td><button className="btn sm" onClick={() => set(u._id, !u.doctorVerified)}>{u.doctorVerified ? 'Revoke' : 'Verify'}</button></td></tr>)}</tbody></table>
    </>
  );
}

function Reviews() {
  const [rows, reload] = useLoad('/admin/reviews');
  const set = (id, status) => api('/admin/reviews/' + id, { method: 'PATCH', body: { status } }).then(reload);
  if (!rows) return <p>Loading…</p>;
  if (!rows.length) return <p className="muted">No reviews waiting for moderation.</p>;
  return rows.map(r => (
    <div className="card between row" key={r._id}><span>{r.user?.name}: {r.rating}★ — {r.comment}</span>
      <span className="row"><button className="btn sm" onClick={() => set(r._id, 'APPROVED')}>Approve</button><button className="btn danger sm" onClick={() => set(r._id, 'REJECTED')}>Reject</button></span></div>
  ));
}

function Audit() {
  const [rows] = useLoad('/admin/audit');
  if (!rows) return <p>Loading…</p>;
  return (
    <table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
      <tbody>{rows.map(a => <tr key={a._id}><td>{new Date(a.createdAt).toLocaleString('en-IN')}</td><td>{a.actor?.name || '-'}</td><td>{a.action}</td><td>{a.entity} {a.entityId}</td></tr>)}</tbody></table>
  );
}

const TABS = { Reports, Inventory, Bookings, Doctors, Reviews, 'Audit trail': Audit };
export default function Admin() {
  const [tab, setTab] = useState('Reports');
  const Tab = TABS[tab];
  return (
    <>
      <h2>Admin dashboard</h2>
      <div className="row tabs">{Object.keys(TABS).map(t => <button key={t} className={'btn sm ' + (t === tab ? '' : 'ghost')} onClick={() => setTab(t)}>{t}</button>)}</div>
      <Tab />
    </>
  );
}
