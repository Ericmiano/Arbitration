import path from 'node:path';
import dotenv from 'dotenv';

// Must run before any test file imports src/config/env (or anything that
// transitively does), so DATABASE_URL etc. point at the test DB rather than
// whatever's in the real .env. dotenv.config() never overwrites variables
// already present in process.env, so this only matters because it runs first.
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes('_test')) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL does not look like a test database. ' +
      'Check server/.env.test exists and points at a dedicated *_test database.',
  );
}
