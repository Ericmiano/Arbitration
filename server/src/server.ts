import './lib/bigintJson';
import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`AAK Arbitration API listening on port ${env.PORT}`);
});
