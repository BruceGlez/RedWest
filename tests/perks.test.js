import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTLAW_PERKS, perkSides, applyPerk, BASE_HEARTS, BASE_SPEED } from '../src/perks.js';
import { CHARACTERS } from '../src/cosmetics.js';
import { OUTLAWS } from '../src/outlaws.js';
import { createProfile, normalizeProfile, buyItem, equipItem, ownsItem } from '../src/profile.js';

const outlawCharacters = CHARACTERS.filter(item => item.unlock);

test('every outlaw is a playable character with a perk and a drawback (a side-grade)', () => {
    assert.equal(outlawCharacters.length, OUTLAWS.length);
    for(const outlaw of OUTLAWS) {
        const perk = OUTLAW_PERKS[outlaw.id];
        assert.ok(perk, `${outlaw.id} has a perk`);
        const { up, down } = perkSides(perk.mods);
        assert.ok(up >= 1, `${outlaw.id}: at least one upside`);
        assert.ok(down >= 1, `${outlaw.id}: at least one downside`);
        assert.ok(perk.perk && perk.drawback, `${outlaw.id}: both are explained`);
    }
});

test('outlaw characters are earned with three stars, never bought', () => {
    const profile = createProfile();
    profile.balances = { dollars: 1e9, nuggets: 1e9 };
    for(const item of outlawCharacters) {
        assert.equal(item.currency, 'dollars', 'never priced in paid currency');
        assert.equal(ownsItem(profile, item.id), false);
        assert.throws(() => buyItem(profile, item.id), { code: 'earned' });
        assert.throws(() => equipItem(profile, item.id), { code: 'not_owned' });
    }
    const silas = outlawCharacters.find(item => item.id === 'char-silas-vane');
    profile.stats.stageStars[silas.unlock.outlaw] = 3; // two stars are not enough
    assert.equal(ownsItem(profile, silas.id), false);
    profile.stats.stageStars[silas.unlock.outlaw] = 7;
    equipItem(profile, silas.id);
    assert.equal(profile.loadout.character, silas.id);
    // A saved game keeps the outlaw equipped (stars are read before the loadout is checked).
    assert.equal(normalizeProfile(structuredClone(profile)).loadout.character, silas.id);
});

test('perks change hearts and speed between runs and never heal mid-run', () => {
    const stats = { hp: 5, maxHp: 5, speed: 15 };
    applyPerk(stats, OUTLAW_PERKS['iron-jack'].mods);
    assert.deepEqual([stats.maxHp, stats.hp, stats.speed], [BASE_HEARTS + 2, BASE_HEARTS + 2, BASE_SPEED * 0.8]);
    stats.hp = 3;
    applyPerk(stats, OUTLAW_PERKS['rattlesnake-rosa'].mods, true);
    assert.equal(stats.hp, 3, 'no free healing during a run');
    applyPerk(stats, undefined);
    assert.deepEqual([stats.maxHp, stats.speed], [BASE_HEARTS, BASE_SPEED], 'Marshal and Drifter have no perk');
});
