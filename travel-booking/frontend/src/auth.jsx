import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me').then(r => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  const done = r => { setToken(r.token); setUser(r.user); return r.user; };
  const value = {
    user, loading, setUser,
    login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }).then(done),
    register: (name, email, password) => api('/auth/register', { method: 'POST', body: { name, email, password } }).then(done),
    logout: () => { setToken(null); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
