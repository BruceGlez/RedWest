import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNews, saveNews, newlyOpened, bannerFor, markSeen, markVisited, talkOfTheTown } from '../src/townNews.js';
import { DISTRICTS, getDistrict, placeName } from '../src/townDistricts.js';
import { FOLK, FOLK_BARK_MAX, folkLine } from '../src/townFolk.js';
import { skyAt, KEYFRAMES, CYCLE_SECONDS } from '../src/townTime.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('what has been announced and visited is remembered, and junk is ignored', () => {
    const storage = memory();
    assert.deepEqual(loadNews(storage), { seen: [], visited: [] });
    saveNews({ seen: ['ranch', 'nope'], visited: ['ranch'] }, storage);
    assert.deepEqual(loadNews(storage), { seen: ['ranch'], visited: ['ranch'] }, 'unknown districts are dropped');
    assert.deepEqual(loadNews({ getItem: () => '{nope' }), { seen: [], visited: [] });
    assert.deepEqual(loadNews(null), { seen: [], visited: [] });
    assert.doesNotThrow(() => saveNews({ seen: [], visited: [] }, { setItem() { throw new Error('private mode'); } }));
});

test('only districts that are open and not yet announced are news, once', () => {
    let news = { seen: [], visited: [] };
    assert.deepEqual(newlyOpened([], news), []);
    assert.deepEqual(newlyOpened(['foundry', 'ranch'], news), ['ranch', 'foundry'], 'in the districts\' own order');
    news = markSeen(news, ['ranch']);
    assert.deepEqual(newlyOpened(['foundry', 'ranch'], news), ['foundry']);
    news = markSeen(news, ['ranch', 'foundry']);
    assert.deepEqual(newlyOpened(['foundry', 'ranch'], news), []);
    assert.match(bannerFor(getDistrict('fort')).title, /NEW: FORT PELL IS OPEN/);
    assert.match(bannerFor(getDistrict('ranch')).text, /west edge/);
    assert.match(bannerFor(getDistrict('canal')).text, /south edge/);
    assert.match(bannerFor(getDistrict('foundry')).text, /north edge/);
    assert.match(bannerFor(getDistrict('crossing')).text, /east edge/);
});

test('the town talks of the newest district until the marshal has been in it', () => {
    let news = { seen: [], visited: [] };
    assert.equal(talkOfTheTown([], news), null);
    assert.equal(talkOfTheTown(['ranch'], news), 'Calloway Farm');
    assert.equal(talkOfTheTown(['ranch', 'canal'], news), "Morgan's Channel", 'the newest one listed');
    news = markVisited(news, 'canal');
    assert.equal(talkOfTheTown(['ranch', 'canal'], news), 'Calloway Farm', 'then the one he has not seen');
    news = markVisited(markVisited(news, 'ranch'), 'ranch');
    assert.deepEqual(news.visited, ['canal', 'ranch'], 'visiting twice is the same as once');
    assert.equal(talkOfTheTown(['ranch', 'canal'], news), null);
});

test('everyone has something to say about a new district, within the limit, for every district', () => {
    for(const person of FOLK) {
        assert.ok(person.react && person.react.includes('{place}'), `${person.id} reacts`);
        for(const d of DISTRICTS) {
            const line = folkLine(person, 0, placeName(d));
            assert.ok(line.includes(placeName(d)) && !line.includes('{'), `${person.id}: names ${d.id}`);
            assert.ok(line.length <= FOLK_BARK_MAX, `${person.id} on ${d.id}: ${line.length} characters`);
        }
        assert.equal(folkLine(person, 0, null), person.lines[0], 'with nothing new, the usual line');
    }
});

test('the day starts at the dusk the town has always had, comes back to it, and goes dark and bright between', () => {
    assert.deepEqual(KEYFRAMES[0], { ...KEYFRAMES[KEYFRAMES.length - 1], at: 0 });
    const start = skyAt(0), end = skyAt(CYCLE_SECONDS), wrapped = skyAt(CYCLE_SECONDS * 3);
    for(const key of Object.keys(start)) assert.equal(end[key], start[key], `${key} comes round`), assert.equal(wrapped[key], start[key]);
    assert.equal(start.sky, 0x1d3640, 'the original dusk sky');
    assert.equal(start.hemiI, 2.4);
    const night = skyAt(CYCLE_SECONDS * 0.3), day = skyAt(CYCLE_SECONDS * 0.78);
    assert.equal(night.name, 'night');
    assert.ok(night.hemiI < start.hemiI && night.sunI < start.sunI && night.bg < 1, 'darker at night');
    assert.ok(night.lamps > day.lamps && night.lights > day.lights, 'lamps shine more at night than by day');
    assert.ok(day.hemiI > start.hemiI && day.sunI > start.sunI, 'brighter by day');
    assert.equal(skyAt(-CYCLE_SECONDS * 0.7).hemiI, skyAt(CYCLE_SECONDS * 0.3).hemiI, 'negative time wraps');
});

test('the light changes smoothly: no sudden jump between neighbouring moments', () => {
    let last = skyAt(0);
    for(let t = 1; t <= CYCLE_SECONDS; t++) {
        const now = skyAt(t);
        assert.ok(Math.abs(now.hemiI - last.hemiI) < 0.12, `hemiI at ${t}s`);
        assert.ok(Math.abs(now.sunI - last.sunI) < 0.12, `sunI at ${t}s`);
        assert.ok(Math.abs(now.lamps - last.lamps) < 0.08, `lamps at ${t}s`);
        last = now;
    }
});
