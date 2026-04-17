import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Landing page after Google OAuth redirect.
 * The backend passes the session token as ?token=... in the URL.
 * We store it in localStorage so the axios interceptor can attach it
 * as a Bearer header on every subsequent API call.
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('session_token', token);
    }

    // Now that the token is stored, checkAuth will send it as a Bearer header
    checkAuth().then(() => {
      navigate('/', { replace: true });
    });
  }, [checkAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#D4A373] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-stone-500 uppercase tracking-widest">Signing you in...</p>
      </div>
    </div>
  );
}
