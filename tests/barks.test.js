import test from 'node:test';
import assert from 'node:assert/strict';
import { barkFor, BARK_MAX } from '../src/barks.js';
import { createProgress, STAR_DEFEATED, STAR_HOT_BOUNTY } from '../src/progress.js';
import { OUTLAWS } from '../src/outlaws.js';

const IDS = ['sheriff', 'gunsmith', 'jail', 'bank', 'saloon', 'tailor', 'depot'];
const banned = /\b(kill|kills|killed|die|dies|died|dead|death|blood|corpse|murder)\b/i;

function progressWith(stars) {
    const p = createProgress();
    stars.forEach((mask, i) => { p.stars[i] = mask; });
    return p;
}

test('every building has a line at every stage of progress, short and fit for every age', () => {
    const stages = [progressWith([]), progressWith([1]), progressWith([3, 3, 1]), progressWith(Array(5).fill(3)), progressWith(Array(OUTLAWS.length).fill(7))];
    for(const id of IDS) for(const progress of stages) {
        const bark = barkFor(id, progress);
        assert.ok(bark && bark.speaker && bark.text, `${id} has a line`);
        assert.ok(bark.text.length <= BARK_MAX, `${id}: ${bark.text.length} characters`);
        assert.ok(!banned.test(bark.text), `${id}: nothing graphic`);
    }
    assert.equal(barkFor('not-a-building', progressWith([])), null);
});

test('the lines follow the marshal: the sheriff counts pages, the jail counts guests, the saloon knows Pete', () => {
    assert.match(barkFor('sheriff', progressWith([])).text, /empty/);
    assert.match(barkFor('sheriff', progressWith([STAR_DEFEATED | STAR_HOT_BOUNTY, STAR_HOT_BOUNTY])).text, /2 pages/);
    assert.match(barkFor('sheriff', progressWith(Array(OUTLAWS.length).fill(STAR_HOT_BOUNTY))).text, /Ten pages/);
    assert.match(barkFor('jail', progressWith([STAR_DEFEATED])).text, /1 guest so far/);
    assert.match(barkFor('jail', progressWith(Array(OUTLAWS.length).fill(STAR_DEFEATED))).text, /full/);
    assert.match(barkFor('saloon', progressWith([])).text, /Tin Cup/);
    assert.match(barkFor('saloon', progressWith([STAR_DEFEATED])).text, /piano/);
    const jack = OUTLAWS.findIndex(o => o.id === 'iron-jack');
    const stars = Array(OUTLAWS.length).fill(0); stars[jack] = STAR_DEFEATED;
    assert.match(barkFor('gunsmith', progressWith(stars)).text, /armour/);
});

test('the same progress always gets the same line', () => {
    const p = progressWith([3, 1]);
    for(const id of IDS) assert.deepEqual(barkFor(id, p), barkFor(id, p));
});
