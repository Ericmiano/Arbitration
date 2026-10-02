import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api',
  // Cookie-based sessions (httpOnly), not a token in localStorage - so it
  // can't be read/exfiltrated by injected script if an XSS bug ever slips in.
  withCredentials: true,
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Laravel Sanctum's SPA (stateful) mode issues a readable, non-httpOnly
// XSRF-TOKEN cookie once a session exists, and expects it echoed back as
// X-XSRF-TOKEN on any mutating request (double-submit cookie pattern) - a
// cross-origin page can trigger the cookie to be sent but can't read it to
// build this header, which is the actual protection.
//
// That cookie (and the session's CSRF token backing it) only gets created
// on whichever request first touches a session-less visitor - and Laravel's
// session store auto-generates that token as part of *starting* the
// session, with no locking between concurrent requests. If two requests
// both hit a brand-new session at once - e.g. this app's own auth-check GET
// (AuthContext's mount-time /auth/me) racing a lazily-primed CSRF GET fired
// only just before the first mutating call - each can independently decide
// "no token yet, generate one", and whichever request's session write lands
// last wins, silently invalidating whatever cookie the *other* request's
// response already handed the browser. That produces an intermittent CSRF
// mismatch on a visitor's very first action, exactly the kind of bug that's
// nearly impossible to reproduce by hand and easy to miss in testing.
//
// The fix is to never let that race happen at all: prime the CSRF cookie
// once, eagerly, as the very first network call of the app's lifetime, and
// hold *every* request - reads included - until it's done. One extra tiny
// GET at page load; free afterwards, since the promise is already settled.
const csrfCookiePrimed: Promise<void> = (() => {
  const root = (apiClient.defaults.baseURL ?? '').replace(/\/api\/?$/, '');

  return axios
    .get(`${root}/sanctum/csrf-cookie`, { withCredentials: true })
    .then(() => undefined)
    .catch(() => undefined); // best-effort - a request that still lacks a token just fails normally and surfaces to its caller
})();

apiClient.interceptors.request.use(async (config) => {
  await csrfCookiePrimed;

  const isMutating = !!config.method && !['get', 'head', 'options'].includes(config.method);
  const token = readCookie('XSRF-TOKEN');
  if (token && isMutating) {
    config.headers.set('X-XSRF-TOKEN', token);
  }
  return config;
});
