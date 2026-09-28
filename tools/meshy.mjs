// Picture to game-ready character through the Meshy API, in one command:
// image to 3D -> auto-rig -> idle / run / run-and-shoot / dead animations -> download ->
// shrink for phones -> public/models/<name>.glb.
//
//   export MESHY_API_KEY=...   (set it in the environment's settings; never commit it)
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp
//   node tools/meshy.mjs <front-view.png> <name> [--height 1.8] [--polycount 8000] [--actions id,id,id,id]
//
// Needs network access to api.meshy.ai. Raw downloads are kept in tools/.meshy-cache/.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { ROLES, optimizeCharacter } from './model-utils.mjs';

const API = (process.env.MESHY_API_BASE || 'https://api.meshy.ai').replace(/\/$/, '');
const POLL_MS = Number(process.env.MESHY_POLL_MS || 5000);
const CACHE = resolve('tools/.meshy-cache');

// Library names to look for, per game role, in order of preference.
const ACTION_SEARCH = {
    idle: ['Idle'],
    run: ['Running', 'Run'],
    runShoot: ['Run and Shoot', 'Running Shoot', 'Shoot'],
    dead: ['Dead', 'Dying', 'Death']
};

function parseArgs(argv) {
    const [image, name, ...rest] = argv;
    const options = { image, name, height: 1.8, polycount: 8000, actions: null };
    for(let i = 0; i < rest.length; i += 2) {
        const key = rest[i].replace(/^--/, '');
        const value = rest[i + 1];
        if(key === 'height') options.height = Number(value);
        else if(key === 'polycount') options.polycount = Number(value);
        else if(key === 'actions') options.actions = value.split(',').map(v => v.trim());
        else throw new Error(`Unknown option --${key}`);
    }
    if(!image || !name || !/^[a-z0-9-]+$/.test(name)) {
        throw new Error('Usage: node tools/meshy.mjs <front-view.png> <name-in-lowercase-with-dashes> [--height 1.8] [--polycount 8000] [--actions id,id,id,id]');
    }
    return options;
}

async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if(!response.ok) throw new Error(`Meshy ${method} ${path} failed (${response.status}): ${data.message || text}`);
    return data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Starts a task and waits for it. Returns the finished task object.
async function runTask(label, path, body) {
    const created = await api(path, { method: 'POST', body });
    const id = created.result ?? created.id;
    if(!id) throw new Error(`${label}: no task id in ${JSON.stringify(created)}`);
    let lastProgress = -1;
    for(;;) {
        const task = await api(`${path}/${id}`);
        if(task.status === 'SUCCEEDED') {
            console.log(`  ${label}: done`);
            return task;
        }
        if(task.status === 'FAILED' || task.status === 'CANCELED' || task.status === 'EXPIRED') {
            throw new Error(`${label} ${task.status.toLowerCase()}: ${task.task_error?.message || 'no reason given'}`);
        }
        if(task.progress !== lastProgress) {
            console.log(`  ${label}: ${task.status?.toLowerCase() ?? 'working'} ${task.progress ?? 0}%`);
            lastProgress = task.progress;
        }
        await sleep(POLL_MS);
    }
}

function listIn(data) {
    if(Array.isArray(data)) return data;
    for(const key of ['result', 'results', 'data', 'items', 'actions']) if(Array.isArray(data?.[key])) return data[key];
    return [];
}

// Finds the library action id for each game role by name.
async function resolveActions() {
    const ids = [];
    for(const role of ROLES) {
        let found = null;
        for(const term of ACTION_SEARCH[role]) {
            const actions = listIn(await api(`/openapi/v1/animations/library?search=${encodeURIComponent(term)}`));
            const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
            found = actions.find(a => norm(a.name) === norm(term)) ?? actions[0] ?? null;
            if(found) break;
        }
        if(!found) throw new Error(`No library animation found for "${role}". Pass --actions with four action ids (idle,run,runShoot,dead).`);
        console.log(`  ${role}: ${found.name} (${found.action_id ?? found.id})`);
        ids.push(found.action_id ?? found.id);
    }
    return ids;
}

async function download(url, file) {
    const response = await fetch(url);
    if(!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    return file;
}

async function main() {
    if(!process.env.MESHY_API_KEY) throw new Error('MESHY_API_KEY is not set. Add it in the environment settings (never paste it into code or chat).');
    const options = parseArgs(process.argv.slice(2));
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extname(options.image).toLowerCase()];
    if(!mime) throw new Error('The picture must be .png, .jpg or .jpeg');
    const imageUrl = `data:${mime};base64,${(await readFile(options.image)).toString('base64')}`;
    await mkdir(CACHE, { recursive: true });

    console.log(`1/4 Image to 3D (${options.polycount} polygons)`);
    const model = await runTask('model', '/openapi/v1/image-to-3d', {
        image_url: imageUrl, should_texture: true, should_remesh: true, topology: 'triangle', target_polycount: options.polycount
    });
    console.log('2/4 Auto-rig');
    const rig = await runTask('rig', '/openapi/v1/rigging', { input_task_id: model.id, height_meters: options.height });
    console.log('3/4 Animations');
    const actionIds = options.actions ?? await resolveActions();
    const animation = await runTask('animations', '/openapi/v1/animations', { rig_task_id: rig.id, action_ids: actionIds });
    const url = animation.result?.animation_glb_url ?? animation.result?.glb_url;
    if(!url) throw new Error(`No GLB in the animation result: ${JSON.stringify(animation.result)}`);

    console.log('4/4 Download and shrink for phones');
    const raw = await download(url, resolve(CACHE, `${options.name}.raw.glb`));
    const output = resolve('public/models', `${options.name}.glb`);
    const result = await optimizeCharacter(raw, output, { requested: ROLES });
    console.log(`Wrote public/models/${options.name}.glb with animations: ${result.animations.join(', ')}`);
    if(result.missing.length) console.log(`Missing animations: ${result.missing.join(', ')} (the game falls back to idle for these).`);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
