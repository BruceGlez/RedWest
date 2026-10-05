// Who owns which file (lanes.json, AGENTS.md).
//   node tools/lanes.mjs list               the lanes and their checks
//   node tools/lanes.mjs check              every tracked file belongs to exactly one lane or is shared
//   node tools/lanes.mjs who <path>...      the lane of each path
//   node tools/lanes.mjs diff [base]        the lanes a branch touches against base (default origin/main);
//                                           add --strict to fail when it touches more than one lane
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const config = JSON.parse(readFileSync(new URL('../lanes.json', import.meta.url), 'utf8'));

function globToRegExp(glob) {
    let out = '';
    for(let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if(c === '*' && glob[i + 1] === '*') { out += '.*'; i++; if(glob[i + 1] === '/') i++; }
        else if(c === '*') out += '[^/]*';
        else out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${out}$`);
}

const compiled = config.lanes.map(lane => ({ lane, patterns: lane.owns.map(globToRegExp) }));
const shared = config.shared.map(globToRegExp);

// 'shared', a lane id, or null when nothing claims the file. Shared wins so a shared file is never silently one lane's.
export function laneOf(path) {
    if(shared.some(re => re.test(path))) return 'shared';
    return compiled.find(({ patterns }) => patterns.some(re => re.test(path)))?.lane.id ?? null;
}

// Files that every lane may add to without a coordination step (new tests and assets are claimed by pattern above).
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

export function unowned(files) { return files.filter(file => laneOf(file) === null); }

function run(argv) {
    const [command, ...rest] = argv;
    if(command === 'list') {
        for(const lane of config.lanes) console.log(`${lane.id.padEnd(8)} ${lane.name}\n         doc: ${lane.doc}\n         checks: ${lane.checks.join(', ')}`);
        console.log(`shared   ${config.shared.length} files that need a small PR of their own`);
    } else if(command === 'check') {
        const missing = unowned(git('ls-files'));
        if(missing.length) { console.error(`Not claimed by any lane (add to lanes.json):\n  ${missing.join('\n  ')}`); process.exit(1); }
        console.log('Every tracked file has an owner.');
    } else if(command === 'who') {
        for(const path of rest) console.log(`${(laneOf(path) ?? 'UNOWNED').padEnd(8)} ${path}`);
    } else if(command === 'diff') {
        const strict = rest.includes('--strict');
        const base = rest.find(arg => !arg.startsWith('--')) ?? 'origin/main';
        const touched = new Map();
        for(const file of git('diff', '--name-only', `${base}...HEAD`)) {
            const id = laneOf(file) ?? 'UNOWNED';
            touched.set(id, [...(touched.get(id) ?? []), file]);
        }
        for(const [id, files] of touched) console.log(`${id}: ${files.length} file(s)`);
        const lanes = [...touched.keys()].filter(id => id !== 'shared');
        if(lanes.length > 1) { console.log(`Touches ${lanes.length} lanes (${lanes.join(', ')}): split the PR unless this is a deliberate cross-lane change.`); if(strict) process.exit(1); }
        if(touched.has('shared')) console.log('Touches shared files: keep that part small and say why in the PR.');
    } else {
        console.error('usage: node tools/lanes.mjs list | check | who <path>... | diff [base] [--strict]');
        process.exit(2);
    }
}

if(process.argv[1] === fileURLToPath(import.meta.url)) run(process.argv.slice(2));
