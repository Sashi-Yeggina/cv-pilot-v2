import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function VerifyEmailPage() {
  const location = useLocation();
  const email: string = (location.state as any)?.email || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('No email address found. Please register again.');
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        toast.error(`Could not resend: ${error.message}`);
      } else {
        setResent(true);
        toast.success('Confirmation email resent!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md text-center">

        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-6">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-500 mb-2">
          We sent a confirmation link to
        </p>
        {email && (
          <p className="font-semibold text-blue-600 mb-6 break-all">{email}</p>
        )}
        <p className="text-gray-500 text-sm mb-8">
          Click the link in the email to activate your account, then come back here to sign in.
        </p>

        {/* Steps */}
        <ol className="text-left space-y-3 mb-8">
          {[
            'Open the confirmation email from Supabase',
            'Click the "Confirm your email" button',
            'You\'ll be redirected — then sign in below',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-600 text-sm">{step}</span>
            </li>
          ))}
        </ol>

        {/* Actions */}
        <Link
          to="/login"
          className="block w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition mb-3"
        >
          Go to Sign In
        </Link>

        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="w-full text-sm text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition py-2"
        >
          {resent ? '✓ Email resent!' : resending ? 'Resending…' : "Didn't receive it? Resend confirmation email"}
        </button>

        <p className="text-center mt-6 text-sm text-gray-400">
          Wrong email?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            Register again
          </Link>
        </p>
      </div>
    </div>
  );
}
