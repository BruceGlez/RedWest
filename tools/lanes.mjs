// Who owns which file (lanes.json, AGENTS.md).
//   node tools/lanes.mjs list               the lanes and their checks
//   node tools/lanes.mjs check              every tracked file belongs to exactly one lane or is shared
//   node tools/lanes.mjs who <path>...      the lane of each path
//   node tools/lanes.mjs diff [base]        the lanes a branch touches against base (default origin/main);
//                                           add --strict to fail when it touches more than one lane
//   node tools/lanes.mjs shared [base] [--max N] [--allow]
//                                           lines changed in shared files against base; fails over N (default 120)
//                                           unless --allow (CI passes it when the PR has the `shared-change` label)
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

// Lines added plus removed in each shared file, from `git diff --numstat` text. Binary files ("-") count as 0.
export function sharedChanges(numstat) {
    const changes = [];
    for(const line of numstat.split('\n').filter(Boolean)) {
        const [added, removed, ...rest] = line.split('\t');
        const file = rest.join('\t');
        if(laneOf(file) !== 'shared') continue;
        changes.push({ file, lines: (Number(added) || 0) + (Number(removed) || 0) });
    }
    return changes;
}

export const SHARED_MAX_LINES = 120;

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
    } else if(command === 'shared') {
        const base = rest.find(arg => !arg.startsWith('--') && !/^\d+$/.test(arg)) ?? 'origin/main';
        const maxIndex = rest.indexOf('--max');
        const max = maxIndex >= 0 ? Number(rest[maxIndex + 1]) : SHARED_MAX_LINES;
        const changes = sharedChanges(git('diff', '--numstat', `${base}...HEAD`).join('\n'));
        const total = changes.reduce((sum, change) => sum + change.lines, 0);
        for(const { file, lines } of changes) console.log(`${String(lines).padStart(5)}  ${file}`);
        console.log(`${total} line(s) changed in shared files (limit ${max}).`);
        if(total > max && !rest.includes('--allow')) {
            console.error(`Too much for shared files. Shared files are where lanes meet: add a small generic hook and keep your lane's logic in your own files (AGENTS.md, rule 3). `
                + `If this is a deliberate change to shared code, put it in its own PR and add the \`shared-change\` label.`);
            process.exit(1);
        }
    } else {
        console.error('usage: node tools/lanes.mjs list | check | who <path>... | diff [base] [--strict] | shared [base] [--max N] [--allow]');
        process.exit(2);
    }
}

if(process.argv[1] === fileURLToPath(import.meta.url)) run(process.argv.slice(2));
