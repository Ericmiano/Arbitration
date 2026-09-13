import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
    } finally {
      // Always show the same confirmation, whether or not the account
      // exists or the request actually succeeded server-side - matches the
      // API's own no-enumeration response.
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-16">
      <div className="w-full max-w-[360px] bg-sheet border border-ink px-30 py-34">
        <div className="font-mono text-15 font-semibold tracking-[0.16em] text-ink">
          A<span className="text-red">A</span>K
        </div>
        <div className="mt-5 font-mono text-9.5 tracking-[0.14em] text-muted">ARBITRATION REGISTER</div>

        {sent ? (
          <div className="mt-24">
            <p className="text-13.5 leading-[1.6] text-ink-2">
              If that email is registered, a reset link has been sent. Check your inbox and follow the link to
              choose a new password.
            </p>
            <Link to="/login" className="mt-16 inline-block border-0 border-b border-ink py-2 text-12.5 hover:text-red hover:border-red">
              Back to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-24 flex flex-col gap-16">
            <p className="text-13 text-ink-2 leading-[1.5]">
              Enter the email on your account and we'll send you a link to reset your password.
            </p>
            <label className="flex flex-col gap-6">
              <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">Email</span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-0 border-b border-rule bg-transparent py-6 text-13 outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover disabled:opacity-60"
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>

            <Link to="/login" className="text-12.5 text-ink-2 hover:text-red">
              Back to log in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
