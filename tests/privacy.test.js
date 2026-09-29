import test from 'node:test';
import assert from 'node:assert/strict';
import { ageBandFromYear, birthYearOptions, isChild, canShareStats } from '../src/privacy.js';
import { validateName, generatedName, isGeneratedName } from '../src/names.js';

const NOW = new Date(2026, 8, 29);

test('age bands use the younger possible age for a birth year', () => {
    assert.equal(ageBandFromYear(2013, NOW), 'under13', 'turns 13 this year: still under 13');
    assert.equal(ageBandFromYear(2012, NOW), 'teen');
    assert.equal(ageBandFromYear(2008, NOW), 'teen', 'turns 18 this year: still a teen');
    assert.equal(ageBandFromYear(2007, NOW), 'adult');
    for(const bad of ['', 'abc', 2027, 1800, 2000.5, null]) assert.equal(ageBandFromYear(bad, NOW), null);
});

test('the year list starts at this year and has no preselected answer', () => {
    const years = birthYearOptions(NOW);
    assert.equal(years[0], 2026);
    assert.equal(years.length, 101);
});

test('children never share statistics', () => {
    assert.equal(isChild({ ageBand: 'under13' }), true);
    assert.equal(canShareStats({ ageBand: 'under13', statsConsent: true }), false);
    assert.equal(canShareStats({ ageBand: 'teen', statsConsent: false }), false);
    assert.equal(canShareStats({ ageBand: 'adult', statsConsent: true }), true);
    assert.equal(canShareStats(null), false);
});

test('the name blocklist catches abuse without blocking innocent names', () => {
    for(const ok of ['DUSTY RIDER', 'SUSSEX', 'ESSEX', 'SEXTON', 'COCKATOO', 'CUMBERLAND', 'SPICY', 'ASSASSIN', 'DICKENS', 'CULOTTE'])
        assert.ok(validateName(ok).ok, ok);
    for(const bad of ['FUCKER', 'F U C K', 'SH1T', 'BIG DICK', 'DICKS', 'THE ADMIN', 'SEX', 'H1TLER', 'PUTA MADRE', 'SUPPORT'])
        assert.equal(validateName(bad).ok, false, bad);
});

test('generated names are valid names and recognisable', () => {
    for(let i = 0; i < 200; i++) {
        const name = generatedName();
        assert.ok(validateName(name).ok, name);
        assert.ok(isGeneratedName(name), name);
    }
    assert.equal(isGeneratedName('DUSTY RIDER'), false);
    assert.equal(isGeneratedName('RIDER 12345'), false);
});
