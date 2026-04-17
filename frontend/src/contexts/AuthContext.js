import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '@/lib/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await API.get('/auth/me');
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirects the browser to the backend, which then redirects to Google.
  const login = () => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch { /* ignore */ }
    localStorage.removeItem('session_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
