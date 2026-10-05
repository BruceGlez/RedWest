import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

// Morgan's Channel waters the farm on the server too (src/farmWater.js): the server clock and the server's own stars decide it.
async function start() {
    let clock = Date.UTC(2026, 8, 28, 12);
    const app = createApp({ store: createMemoryStore(), env: {}, now: () => new Date(clock) });
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { token, body } = {}) => {
        const response = await fetch(base + path, {
            method: 'POST',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        return { status: response.status, data: await response.json() };
    };
    const account = async () => (await call('/api/account')).data;
    const advanceMinutes = minutes => { clock += minutes * 60000; };
    return { call, account, advanceMinutes, close: () => new Promise(r => server.close(r)) };
}

// Beat the first `count` outlaws in order (the Calloways are the fourth, Mad Mesa Morgan the sixth).
async function beat(s, token, count) {
    for(let outlawIndex = 0; outlawIndex < count; outlawIndex++) {
        await s.call('/api/run', { token, body: { score: 900, seconds: 120, outlawIndex, bounty: 'banked', kills: {} } });
        s.advanceMinutes(60);
    }
}

test('the Channel waters the farm on the server only once Morgan is beaten, and never changes the farm without it', async () => {
    const s = await start();
    try {
        const dry = await s.account();
        const wet = await s.account();
        await beat(s, dry.token, 4); // the Calloways, not Morgan
        await beat(s, wet.token, 6); // and Morgan
        const farm = (a, body) => s.call('/api/town/farm', { token: a.token, body });
        assert.equal((await farm(dry, { action: 'plant', plot: 0, crop: 'wheat' })).status, 200);
        assert.equal((await farm(wet, { action: 'plant', plot: 0, crop: 'wheat' })).status, 200);
        s.advanceMinutes(19);
        assert.equal((await farm(dry, { action: 'harvest', plot: 0 })).data.code, 'not_ready', 'twenty minutes have not passed');
        const harvested = await farm(wet, { action: 'harvest', plot: 0 });
        assert.deepEqual(harvested.data.result, { good: 'wheat', amount: 2 }, 'eighteen have, and that is enough with the water');
        s.advanceMinutes(1);
        assert.deepEqual((await farm(dry, { action: 'harvest', plot: 0 })).data.result, { good: 'wheat', amount: 2 });
    } finally {
        await s.close();
    }
});
