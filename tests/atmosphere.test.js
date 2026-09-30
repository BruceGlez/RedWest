import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROES } from '../src/heroProps.js';
import { ATMOSPHERES, DEFAULT_ATMOSPHERE, KIT_CAPACITY, atmosphereFor } from '../src/atmosphere.js';
import { OUTLAWS } from '../src/outlaws.js';

const isHex = value => Number.isInteger(value) && value >= 0 && value <= 0xffffff;
const brightness = hex => (((hex >> 16) & 255) + ((hex >> 8) & 255) + (hex & 255)) / 3;

test('every outlaw has a stage atmosphere, and none is left over', () => {
    for(const outlaw of OUTLAWS) assert.ok(ATMOSPHERES[outlaw.id], `${outlaw.id} has an atmosphere`);
    for(const id of Object.keys(ATMOSPHERES)) assert.ok(OUTLAWS.some(o => o.id === id), `${id} is an outlaw`);
});

test('atmospheres are complete, and the fight stays readable', () => {
    for(const [id, look] of [['default', DEFAULT_ATMOSPHERE], ...Object.entries(ATMOSPHERES)]) {
        assert.equal(look.sky.length, 4, `${id}: four sky stops`);
        for(const hex of [...look.sky, look.fog.color, look.hemi.sky, look.hemi.ground, look.sun.color, look.ground, look.props]) {
            assert.ok(isHex(hex), `${id}: colours are hex numbers`);
        }
        assert.ok(look.fog.near > 0 && look.fog.far > look.fog.near + 30, `${id}: fog leaves a clear zone around the player`);
        assert.ok(look.fog.far <= 130, `${id}: fog hides the edge of the 300-wide ground`);
        assert.equal(look.sun.offset.length, 3);
        assert.ok(look.sun.offset[1] >= 18, `${id}: the sun stays high enough for shadows to fit the shadow box`);
        // A night is dim, but the ground and the enemies on it must still read on a phone.
        assert.ok(look.hemi.intensity >= 1.1 && look.sun.intensity >= 1.2, `${id}: light is never too dark`);
        assert.ok(look.wind >= 0 && look.wind <= 1, `${id}: wind is 0 to 1`);
        assert.ok(Number.isInteger(look.weeds) && look.weeds >= 0 && look.weeds <= 4, `${id}: up to four tumbleweeds`);
        const { motes } = look;
        assert.ok(isHex(motes.color) && motes.count > 0 && motes.count <= 120 && motes.opacity > 0 && motes.opacity <= 1 && motes.size > 0, `${id}: motes are complete`);
        assert.ok(brightness(look.ground) >= 120, `${id}: the sand tint does not black out the ground`);
    }
});

test('a stage without an atmosphere falls back to the default', () => {
    assert.equal(atmosphereFor('a-future-outlaw'), DEFAULT_ATMOSPHERE);
});

test('every stage has its own ground, its own props, and no two stages look alike', () => {
    const seen = new Set();
    for(const [id, look] of [['default', DEFAULT_ATMOSPHERE], ...Object.entries(ATMOSPHERES)]) {
        const { terrain, kit, palette } = look;
        assert.ok(/^#[0-9a-f]{6}$/i.test(terrain.base), `${id}: ground base colour`);
        assert.ok(terrain.grain.length === 2 && terrain.cracks >= 0 && terrain.pebbles >= 0 && terrain.scrubs >= 0, `${id}: ground counts`);
        assert.ok([null, 'ruts', 'furrows', 'planks', 'patches'].includes(terrain.extra), `${id}: known ground pattern`);
        if(terrain.extra) assert.ok(terrain.extraColor, `${id}: pattern colour`);
        assert.deepEqual(Object.keys(kit).sort(), Object.keys(KIT_CAPACITY).sort(), `${id}: a count for every kind of prop`);
        let total = 0;
        for(const [kind, count] of Object.entries(kit)) {
            assert.ok(Number.isInteger(count) && count >= 0, `${id}: ${kind} count`);
            assert.ok(count + 4 <= KIT_CAPACITY[kind], `${id}: ${kind} leaves room to respawn`);
            total += count;
        }
        assert.ok(total >= 60 && total <= 150, `${id}: ${total} props keeps the arena playable and cheap`);
        assert.equal(palette.rock.length, 2, `${id}: two rock colours`);
        seen.add(JSON.stringify([terrain.base, kit]));
    }
    assert.equal(seen.size, Object.keys(ATMOSPHERES).length + 1, 'every stage has a different ground and prop mix');
});

test('every stage has a skyline', () => {
    for(const [id, look] of [['default', DEFAULT_ATMOSPHERE], ...Object.entries(ATMOSPHERES)]) {
        assert.ok(['mesa', 'peaks', 'hills', 'stacks', 'flat'].includes(look.horizon.style), `${id}: known skyline`);
        assert.ok(look.horizon.height > 0 && look.horizon.height <= 2 && look.horizon.strength >= 0 && look.horizon.strength <= 1, `${id}: skyline numbers`);
    }
});

test('every stage has a landmark that exists, stands clear of the start, and does not block the arena', () => {
    const seen = new Set();
    for(const [id, look] of Object.entries(ATMOSPHERES)) {
        assert.ok(look.hero && HEROES[look.hero.id], `${id}: a known landmark`);
        const [x, z] = look.hero.at;
        assert.ok(Math.hypot(x, z) >= 26 && Math.hypot(x, z) <= 45, `${id}: a walk from the start, inside the map`);
        for(const circle of HEROES[look.hero.id].blocks) assert.ok(circle.r > 0 && circle.r <= 4, `${id}: a reasonable blocker`);
        seen.add(look.hero.id);
    }
    assert.equal(seen.size, Object.keys(ATMOSPHERES).length, 'every stage has a different landmark');
});
