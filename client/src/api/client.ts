import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api',
  // Cookie-based sessions (httpOnly), not a token in localStorage - so it
  // can't be read/exfiltrated by injected script if an XSS bug ever slips in.
  withCredentials: true,
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// The API issues a readable (non-httpOnly) csrf_token cookie on every
// response and requires it echoed back as this header on any mutating
// request (double-submit cookie pattern - see server/src/middleware/csrf.ts).
// A cross-origin attacker's page can trigger the cookie to be *sent*
// automatically but can't *read* it to build this header, which is the
// actual protection; a same-origin request always can, which is why this
// interceptor alone is enough for every apiClient call in the app.
apiClient.interceptors.request.use((config) => {
  const token = readCookie('csrf_token');
  if (token && config.method && !['get', 'head', 'options'].includes(config.method)) {
    config.headers.set('x-csrf-token', token);
  }
  return config;
});
