import test from 'node:test';
import { existsSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { STORY, OPENING, ENDING, CHAPTER_ONE_END, CARD_MAX, PAGE_MAX, CARD_STARS, storyFor, unlockedCards, hasPage, pagesHeld, caseComplete } from '../src/story.js';
import { OUTLAWS } from '../src/outlaws.js';
import { createProgress, STAR_DEFEATED, STAR_HOT_BOUNTY, STAR_ESCAPED } from '../src/progress.js';

test('every outlaw has three story cards and a ledger page, and none is left over', () => {
    for(const outlaw of OUTLAWS) {
        const story = storyFor(outlaw.id);
        assert.ok(story, `${outlaw.id} has a story`);
        assert.equal(story.cards.length, 3, `${outlaw.id}: three cards, one per star`);
        assert.ok(story.page.title && story.page.text, `${outlaw.id}: a ledger page`);
    }
    for(const id of Object.keys(STORY)) assert.ok(OUTLAWS.some(o => o.id === id), `${id} is an outlaw`);
});

test('cards and pages stay short enough for one phone screen', () => {
    for(const [id, story] of Object.entries(STORY)) {
        for(const card of story.cards) {
            assert.ok(card.title.length > 0 && card.title.length <= 32, `${id}: card title "${card.title}"`);
            assert.ok(card.text.length > 40 && card.text.length <= CARD_MAX, `${id}: "${card.title}" is ${card.text.length} characters`);
        }
        assert.ok(story.page.text.length <= PAGE_MAX, `${id}: page text is ${story.page.text.length} characters`);
        assert.ok(story.page.title.length <= 40, `${id}: page title`);
    }
    assert.ok(CHAPTER_ONE_END.text.length <= 700);
});

test('the story stays fit for every age: loss is told, never shown', () => {
    const banned = /\b(kill|kills|killed|killing|die|dies|died|dead|death|blood|bleed|corpse|murder|murdered|shot dead|hang|hanged|gun down)\b/i;
    const texts = [CHAPTER_ONE_END.title, CHAPTER_ONE_END.text];
    for(const story of Object.values(STORY)) texts.push(story.page.title, story.page.text, ...story.cards.flatMap(c => [c.title, c.text]));
    for(const text of texts) assert.ok(!banned.test(text), `no graphic words: "${text.slice(0, 60)}"`);
});

test('the cards follow the three stars, and the ledger page comes with the second', () => {
    assert.deepEqual(CARD_STARS, [STAR_DEFEATED, STAR_HOT_BOUNTY, STAR_ESCAPED]);
    assert.deepEqual(unlockedCards(0), [false, false, false]);
    assert.deepEqual(unlockedCards(STAR_DEFEATED), [true, false, false]);
    assert.deepEqual(unlockedCards(STAR_DEFEATED | STAR_ESCAPED), [true, false, true]);
    assert.equal(hasPage(STAR_DEFEATED), false);
    assert.equal(hasPage(STAR_HOT_BOUNTY), true);
});

test('the case file completes only when all pages are held', () => {
    const progress = createProgress();
    assert.deepEqual(pagesHeld(progress), []);
    progress.stars[2] = STAR_DEFEATED | STAR_HOT_BOUNTY;
    progress.stars[0] = STAR_DEFEATED; // defeated but no bounty collected: no page yet
    assert.deepEqual(pagesHeld(progress), [2]);
    assert.equal(caseComplete(progress, OUTLAWS.length), false);
    progress.stars = progress.stars.map(() => STAR_HOT_BOUNTY);
    assert.equal(caseComplete(progress, OUTLAWS.length), true);
});

test('a future outlaw without a story falls back to nothing', () => {
    assert.equal(storyFor('a-future-outlaw'), null);
});

test('the opening and the ending are short panels, fit for every age', () => {
    const banned = /\b(kill|kills|killed|die|dies|died|dead|death|blood|corpse|murder)\b/i;
    assert.equal(OPENING.length, 4);
    assert.equal(ENDING.length, 3);
    for(const panel of [...OPENING, ...ENDING]) {
        assert.ok(panel.title.length <= 32 && panel.text.length > 40 && panel.text.length <= CARD_MAX, `"${panel.title}": ${panel.text.length} characters`);
        assert.ok(!banned.test(panel.text), `"${panel.title}": nothing graphic`);
    }
    assert.match(OPENING[0].text, /grow old/, 'the Drifter is a rumour on the road');
});

test('every opening and ending panel has its picture, small enough for a phone', () => {
    for(const panel of [...OPENING, ...ENDING]) {
        assert.ok(panel.image && panel.image.startsWith('story/'), `"${panel.title}" names a picture`);
        const file = new URL(`../public/${panel.image}`, import.meta.url);
        assert.ok(existsSync(file), `${panel.image} exists`);
        assert.ok(statSync(file).size < 120 * 1024, `${panel.image} stays under 120 KB`);
    }
});
