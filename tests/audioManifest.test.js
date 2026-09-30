import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SFX, MUSIC, VOICE } from '../src/audioManifest.js';
import { OUTLAWS } from '../src/outlaws.js';

const file = (dir, key) => new URL(`../public/audio/${dir}/${key}.mp3`, import.meta.url);

test('every sound in the manifest has its file', () => {
    for(const key of Object.keys(SFX)) assert.ok(existsSync(file('sfx', key)), `sfx/${key}`);
    for(const key of Object.keys(MUSIC)) assert.ok(existsSync(file('music', key)), `music/${key}`);
    for(const key of Object.keys(VOICE)) assert.ok(existsSync(file('voice', key)), `voice/${key}`);
});

test('each outlaw says the words their ride-in banner shows', () => {
    for(const outlaw of OUTLAWS) assert.equal(VOICE[outlaw.id]?.text, outlaw.taunt, outlaw.id);
});

test('a variant always has a base sound, and the loud guns have more than one recording', () => {
    for(const key of Object.keys(SFX)) {
        const match = key.match(/^(.*)-[23]$/);
        if(match) assert.ok(SFX[match[1]], `${key} has a base ${match[1]}`);
    }
    for(const gun of ['shot-revolver', 'shot-twins', 'shot-rifle', 'shot-shotgun', 'shot-sawedoff', 'shot-buffalo', 'hit']) {
        assert.ok(SFX[`${gun}-2`], `${gun} has a second recording`);
    }
    assert.ok(MUSIC['fight-hot'], 'a hotter fight loop');
});
