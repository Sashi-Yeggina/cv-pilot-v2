import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    let done = false;

    const finish = async (session: any) => {
      if (done) return;
      done = true;
      const { user, access_token } = session;

      // Fetch the real role from public.users — never hardcode 'user'
      let role = 'user';
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        if (data?.role) role = data.role;
      } catch (_) { /* fall back to 'user' */ }

      setAuth(access_token, user.id, user.email || '', role, true);
      // Admins go straight to admin panel, everyone else to dashboard
      navigate(role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    };

    const abort = () => {
      if (done) return;
      done = true;
      navigate('/login', { replace: true });
    };

    // In PKCE flow, Supabase exchanges the ?code= param automatically.
    // getSession() will return the session once that exchange completes.
    // Poll briefly to catch it, then fall back to onAuthStateChange.
    const poll = async () => {
      console.log('[Callback] Starting. URL:', window.location.href);
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (done) return;
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log(`[Callback] Poll ${i + 1}: session=`, session?.user?.email, 'error=', error);
        if (session) { finish(session); return; }
      }
      console.log('[Callback] Timed out — no session found, going to login');
      abort();
    };

    poll();

    // Also listen for the event in case it fires before polling catches it
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Callback] Auth event:', event, 'session:', session?.user?.email);
      if (event === 'SIGNED_IN' && session) finish(session);
    });

    return () => subscription.unsubscribe();
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
