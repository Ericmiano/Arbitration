import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api',
  // Cookie-based sessions (httpOnly), not a token in localStorage - so it
  // can't be read/exfiltrated by injected script if an XSS bug ever slips in.
  withCredentials: true,
});
