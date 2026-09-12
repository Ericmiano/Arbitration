import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password');
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

        <form onSubmit={handleSubmit} className="mt-24 flex flex-col gap-16">
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
          <label className="flex flex-col gap-6">
            <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">Password</span>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
            {submitting ? 'Signing in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
