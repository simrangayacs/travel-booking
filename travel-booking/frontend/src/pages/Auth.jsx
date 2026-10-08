import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'login') await login(f.email, f.password); else await register(f.name, f.email, f.password);
      nav(loc.state?.from || '/', { replace: true });
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
      {mode === 'register' && <label>Name<input value={f.name} onChange={set('name')} required minLength={2} /></label>}
      <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
      <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} /></label>
      {err && <p className="error">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button>
      <p className="muted">{mode === 'login' ? <>New here? <Link to="/register">Create account</Link></> : <>Have an account? <Link to="/login">Login</Link></>}</p>
      {mode === 'login' && <p className="muted small">Demo: demo@demo.com / Demo@1234 · Admin: admin@demo.com / Admin@1234 · Doctor: doctor@demo.com / Doctor@1234</p>}
    </form>
  );
}
export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
