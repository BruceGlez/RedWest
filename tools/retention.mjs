// Return rates and where players stop, from the server's data file (only players who opted in).
//
//   node tools/retention.mjs [path/to/redwest.json]   (default: $DATA_FILE or ./data/redwest.json)
//
// Day-N return: of the players whose first day was at least N days ago, the share who played on day N.
import { readFileSync } from 'node:fs';
import { ANALYTICS_EVENTS } from '../src/analytics.js';

const file = process.argv[2] || process.env.DATA_FILE || './data/redwest.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const players = Object.values(data.users || {}).map(user => user.analytics).filter(Boolean);
const DAY = 86400000;
const today = Date.parse(new Date().toISOString().slice(0, 10));
const dayNumber = (first, day) => Math.round((Date.parse(day) - Date.parse(first)) / DAY);

console.log(`${players.length} players share statistics (${file})\n`);
for(const n of [1, 7, 30]) {
    const cohort = players.filter(p => (today - Date.parse(p.firstDay)) / DAY >= n);
    const returned = cohort.filter(p => p.days.some(day => dayNumber(p.firstDay, day) === n));
    const share = cohort.length ? `${Math.round((returned.length / cohort.length) * 100)}%` : 'n/a';
    console.log(`Day ${String(n).padEnd(2)} return: ${share.padStart(4)}  (${returned.length} of ${cohort.length})`);
}
console.log('\nPlayers who ever did each step:');
for(const name of ANALYTICS_EVENTS) {
    const did = players.filter(p => (p.counts?.[name] || 0) > 0).length;
    const total = players.reduce((sum, p) => sum + (p.counts?.[name] || 0), 0);
    console.log(`  ${name.padEnd(15)} ${String(did).padStart(5)} players  ${String(total).padStart(7)} times`);
}
