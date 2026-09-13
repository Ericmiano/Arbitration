import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate('/login', { replace: true });
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'This reset link is invalid or has expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-16">
      <div className="w-full max-w-[360px] bg-sheet border border-ink px-30 py-34">
        <div className="font-mono text-15 font-semibold tracking-[0.16em] text-ink">
          A<span className="text-red">A</span>K
        </div>
        <div className="mt-5 font-mono text-9.5 tracking-[0.14em] text-muted">ARBITRATION REGISTER</div>

        {!token ? (
          <div className="mt-24">
            <p className="text-13.5 text-red">This reset link is missing its token.</p>
            <Link to="/forgot-password" className="mt-16 inline-block border-0 border-b border-ink py-2 text-12.5 hover:text-red hover:border-red">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-24 flex flex-col gap-16">
            <label className="flex flex-col gap-6">
              <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">New password</span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="border-0 border-b border-rule bg-transparent py-6 text-13 outline-none"
              />
            </label>
            <label className="flex flex-col gap-6">
              <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">Confirm password</span>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="border-0 border-b border-rule bg-transparent py-6 text-13 outline-none"
              />
            </label>

            {error && (
              <p role="alert" className="text-12.5 text-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
