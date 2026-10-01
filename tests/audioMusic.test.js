import test from 'node:test';
import assert from 'node:assert/strict';

// The music in src/audio.js, driven with a pretend Web Audio so the order of events can be controlled: when each music file
// finishes loading, when the audio context unlocks (a phone only runs it after a tap), when tracks change. Two songs must
// never play at once, and no song may be started in a context that is not running (on iPhone it then plays out of step,
// on top of the next one: the song "duplicating" after a run, seen in the Boss Arena, which switches tracks twice at once).

const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, setValueCurveAtTime() {} });

function setup() {
    const world = { ctx: null, live: new Set(), startedWhileNotRunning: 0, musicStarts: [], intervals: new Set(), pending: [], store: new Map() };
    class Node {
        constructor(kind, ctx) {
            this.kind = kind; this.ctx = ctx;
            for(const name of ['gain', 'frequency', 'Q', 'detune', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = param();
        }
        connect(x) { return x; }
        disconnect() { world.live.delete(this); }
        start() {
            if(this.kind !== 'source' || !this.loop || !(this.buffer?.duration > 20)) return;
            if(this.ctx.state !== 'running') world.startedWhileNotRunning++;
            world.live.add(this);
            world.musicStarts.push(this.buffer.url);
        }
        stop() { world.live.delete(this); }
    }
    class Ctx {
        constructor() {
            this.currentTime = 0; this.sampleRate = 44100; this.state = world.startSuspended ? 'suspended' : 'running';
            this.destination = new Node('dest', this); world.ctx = this;
        }
        createGain() { return new Node('gain', this); }
        createBiquadFilter() { return new Node('filter', this); }
        createDynamicsCompressor() { return new Node('comp', this); }
        createOscillator() { return new Node('osc', this); }
        createBufferSource() { return new Node('source', this); }
        createBuffer(channels, length) { return { duration: 2, length, getChannelData: () => new Float32Array(16) }; }
        decodeAudioData(data, ok) { ok({ duration: 45, url: data.url }); }
        resume() { return new Promise(resolve => world.pendingResume.push(() => { this.state = 'running'; resolve(); })); }
    }
    world.pendingResume = [];
    world.unlock = () => { for(const run of world.pendingResume.splice(0)) run(); };
    Object.assign(globalThis, {
        window: globalThis, AudioContext: Ctx,
        localStorage: { getItem: k => world.store.get(k) ?? null, setItem: (k, v) => world.store.set(k, v) },
        setInterval: () => { const id = Symbol('interval'); world.intervals.add(id); return id; },
        clearInterval: id => world.intervals.delete(id),
        fetch: url => new Promise(resolve => {
            const done = () => resolve({ ok: true, arrayBuffer: async () => Object.assign(new ArrayBuffer(8), { url: String(url) }) });
            if(String(url).includes('music/')) world.pending.push(done); else done();
        })
    });
    return world;
}

let fresh = 0;
async function load(options = {}) {
    const world = setup();
    world.startSuspended = !!options.suspended;
    const audio = await import(`../src/audio.js?fresh=${++fresh}`);
    await flush();
    return { world, audio };
}
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); await new Promise(r => setImmediate(r)); };
const voices = world => world.live.size + (world.intervals.size ? 1 : 0);

function random(seed) {
    let state = seed;
    const next = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
    return { next, pick: list => list[Math.floor(next() * list.length)] };
}
const TRACKS = ['home', 'fight', 'fight-hot', 'showdown'];

test('two songs never play at once, whatever order the files load and the tracks change in', async () => {
    const { world, audio } = await load();
    const rng = random(7);
    for(let i = 0; i < 4000; i++) {
        const roll = rng.next();
        if(roll < 0.3) audio.setMusicTrack(rng.pick(TRACKS));
        else if(roll < 0.45) audio.resumeAudio();
        else if(roll < 0.7 && world.pending.length) world.pending.splice(Math.floor(rng.next() * world.pending.length), 1)[0]();
        else if(roll < 0.8) audio.setMusicEnabled(rng.next() < 0.5);
        else if(roll < 0.9) audio.setFightIntensity(rng.next() < 0.5);
        else audio.toggleMusicEnabled();
        await flush();
        assert.ok(world.live.size <= 1, `step ${i}: ${world.live.size} recorded songs at once`);
        assert.ok(voices(world) <= 1, `step ${i}: a recorded song and the synth loop together`);
    }
});

test('on a phone the audio context is locked until the first tap: no song is started in it, and still only one plays', async () => {
    const { world, audio } = await load({ suspended: true });
    const rng = random(11);
    for(let i = 0; i < 4000; i++) {
        const roll = rng.next();
        if(roll < 0.3) audio.setMusicTrack(rng.pick(TRACKS));
        else if(roll < 0.45) audio.resumeAudio();
        else if(roll < 0.6) world.unlock(); // the tap finishes unlocking the context
        else if(roll < 0.8 && world.pending.length) world.pending.splice(Math.floor(rng.next() * world.pending.length), 1)[0]();
        else if(roll < 0.9) audio.setMusicEnabled(rng.next() < 0.5);
        else audio.setFightIntensity(rng.next() < 0.5);
        await flush();
        assert.equal(world.startedWhileNotRunning, 0, `step ${i}: a song was started while the context was not running`);
        assert.ok(voices(world) <= 1, `step ${i}: ${voices(world)} songs at once`);
    }
});

test('the arena switches fight, then showdown, in the same instant: the first is never started', async () => {
    const { world, audio } = await load();
    for(const done of world.pending.splice(0)) done(); // every music file is ready
    await flush();
    audio.resumeAudio(); // the first tap: the home song starts
    await flush();
    assert.equal(world.live.size, 1);
    for(const track of ['fight', 'fight-hot', 'showdown', 'home']) { // each file is fetched the first time its track is wanted
        audio.setMusicTrack(track);
        await flush();
        for(const done of world.pending.splice(0)) done();
        await flush();
    }
    assert.equal(world.live.size, 1);
    world.musicStarts.length = 0;
    audio.setMusicTrack('fight');
    audio.setMusicTrack('showdown'); // the arena goes straight to the outlaw
    await flush();
    assert.equal(world.live.size, 1);
    assert.deepEqual(world.musicStarts.map(url => url.match(/music\/([a-z-]+)\.mp3/)[1]), ['showdown'], 'only the last track is started');
});

test('a context that unlocks late starts the song once it is running, and only one', async () => {
    const { world, audio } = await load({ suspended: true });
    for(const done of world.pending.splice(0)) done();
    await flush();
    audio.resumeAudio();
    audio.resumeAudio();
    await flush();
    assert.equal(world.live.size, 0, 'nothing plays while the context is locked');
    world.unlock();
    await flush();
    assert.equal(world.live.size, 1, 'the song starts once the context runs');
    assert.equal(world.startedWhileNotRunning, 0);
});
