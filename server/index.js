import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createFileStore } from './store.js';

// Environment: PORT, ALLOWED_ORIGIN, REVENUECAT_WEBHOOK_AUTH, STRIPE_WEBHOOK_SECRET,
// STRIPE_PAYMENT_LINKS (JSON: {"plink_...": "nuggets_550"}). See MONETIZATION.md.
// The store: the JSON file at DATA_FILE by default, or Postgres with STORE=postgres and DATABASE_URL (PG_POOL_MAX is optional). docs/DEPLOY.md.
const usePostgres = process.env.STORE === 'postgres';
const store = usePostgres
    ? await (await import('./pgStore.js')).createPgStore({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX) || 10 })
    : createFileStore(process.env.DATA_FILE || './data/redwest.json');
const server = createServer(createApp({ store, env: process.env }));
const port = Number(process.env.PORT) || 8787;
server.listen(port, () => console.log(`Red West server listening on :${port} (${usePostgres ? 'postgres' : 'json file'} store)`));

// A redeploy sends SIGTERM: stop taking requests, finish the ones running, close the database, then exit.
for(const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        server.close(async () => {
            try { await store.close?.(); } finally { process.exit(0); }
        });
        setTimeout(() => process.exit(1), 10000).unref(); // do not hang a deploy on a stuck connection
    });
}
