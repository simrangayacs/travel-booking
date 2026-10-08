import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { useT } from './i18n';
import Home from './pages/Home';
import { Login, Register } from './pages/Auth';
import Checkout from './pages/Checkout';
import Bookings from './pages/Bookings';
import Emergency from './pages/Emergency';
import Admin from './pages/Admin';
import Verify from './pages/Verify';

function Guard({ children, admin }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="center">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const { t, lang, toggle } = useT();
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">✈ TravelBook</Link>
        <nav>
          <NavLink to="/">{t('search')}</NavLink>
          {user && <NavLink to="/bookings">{t('bookings')}</NavLink>}
          {user && <NavLink to="/emergency">{t('emergency')}</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">{t('admin')}</NavLink>}
          <button className="link" onClick={toggle} title="Language">{lang === 'en' ? 'हिं' : 'EN'}</button>
          {user ? <button className="link" onClick={logout}>{t('logout')} ({user.name.split(' ')[0]})</button> : <NavLink to="/login">{t('login')}</NavLink>}
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify/:bookingId" element={<Verify />} />
          <Route path="/checkout/:id" element={<Guard><Checkout /></Guard>} />
          <Route path="/bookings" element={<Guard><Bookings /></Guard>} />
          <Route path="/emergency" element={<Guard><Emergency /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <footer className="foot">Travel Booking Website | Hackathon Submission</footer>
    </>
  );
}
