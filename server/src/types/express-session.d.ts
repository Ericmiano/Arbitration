import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      role: 'admin' | 'registrar' | 'staff' | 'arbitrator' | 'party';
    };
  }
}
