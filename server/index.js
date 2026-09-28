import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createFileStore } from './store.js';

// Environment: PORT, DATA_FILE, ALLOWED_ORIGIN, REVENUECAT_WEBHOOK_AUTH, STRIPE_WEBHOOK_SECRET,
// STRIPE_PAYMENT_LINKS (JSON: {"plink_...": "nuggets_550"}). See MONETIZATION.md.
const store = createFileStore(process.env.DATA_FILE || './data/redwest.json');
const server = createServer(createApp({ store, env: process.env }));
const port = Number(process.env.PORT) || 8787;
server.listen(port, () => console.log(`Red West server listening on :${port}`));
