import { migrateJsonToStore } from './migrate.js';

// node server/migrate-cli.js [--file /data/redwest.json] [--dry-run] [--overwrite]
// Needs DATABASE_URL. Run it with the app stopped (docs/DEPLOY.md, "Moving the players from the JSON file to Postgres").
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const known = new Set(['--file', '--dry-run', '--overwrite', '--help']);
const unknown = args.filter((a, i) => a.startsWith('--') && !known.has(a));
if(flag('--help') || unknown.length) {
    console.log('Usage: DATABASE_URL=... node server/migrate-cli.js [--file /data/redwest.json] [--dry-run] [--overwrite]\n  --dry-run    say what would be copied, change nothing\n  --overwrite  replace players that are already in Postgres (default: leave them alone)');
    process.exit(unknown.length ? 2 : 0);
}
const file = value('--file') || process.env.DATA_FILE || './data/redwest.json';
if(!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }

const { createPgStore } = await import('./pgStore.js');
const store = await createPgStore({ connectionString: process.env.DATABASE_URL, max: 4 });
try {
    const report = await migrateJsonToStore({ file, store, dryRun: flag('--dry-run'), overwrite: flag('--overwrite'), log: line => console.error(line) });
    const row = (label, value, note = '') => `  ${label.padEnd(24)}${value}${note}`;
    console.log([
        `${report.dryRun ? 'DRY RUN, nothing written. ' : ''}From ${file}:`,
        row('players in the file', report.users),
        row(report.dryRun ? 'would copy' : 'copied', report.inserted),
        row(report.dryRun ? 'would replace' : 'replaced', report.replaced),
        row('already in Postgres', report.alreadyThere, report.alreadyThere && !flag('--overwrite') ? ' (left alone)' : ''),
        row('not players (skipped)', report.invalid),
        row('failed', report.failed.length),
        row('read back different', report.mismatched.length),
        row('retained purchases', report.retained, report.dryRun ? '' : ' (kept once each)'),
        report.ok ? 'OK' : 'NOT OK: see the lines above. The JSON file was not changed; fix the cause and run again.'
    ].join('\n'));
    process.exitCode = report.ok ? 0 : 1;
} finally {
    await store.close();
}
