import { FormEvent, useState } from 'react';
import { apiClient } from '../api/client';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiClient.post('/auth/login', { email, password });
      window.location.href = '/dashboard';
    } catch {
      setError('Invalid email or password');
    }
  }

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <h1>AAK Arbitration - Sign in</h1>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}
