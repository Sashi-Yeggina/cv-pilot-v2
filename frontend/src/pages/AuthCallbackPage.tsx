import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from Supabase (it's automatically set when redirected back)
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          console.error('Auth error:', error);
          navigate('/login');
          return;
        }

        // Extract user info
        const { user, access_token } = session;
        if (!user || !access_token) {
          navigate('/login');
          return;
        }

        // Determine role (default to 'user' for OAuth signups)
        // In production, you might fetch this from your users table
        const role = 'user';

        // Store auth info — Google OAuth always remembers (user explicitly chose to sign in)
        setAuth(access_token, user.id, user.email || '', role, true);

        // Redirect to dashboard
        navigate('/dashboard');
      } catch (err) {
        console.error('Callback error:', err);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, setAuth]);

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white text-lg font-semibold">Signing you in…</p>
      </div>
    </div>
  );
}
