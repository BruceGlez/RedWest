import test from 'node:test';
import assert from 'node:assert/strict';
import {
    COMIC_STORIES,
    hasSeenComic,
    markComicSeen,
    renderComicIntroHtml
} from '../src/comicIntro.js';

function createMockStorage() {
    const store = new Map();
    return {
        getItem: key => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: key => store.delete(key),
        clear: () => store.clear()
    };
}

test('COMIC_STORIES defines a 4-panel storyboard for Dusty Pete', () => {
    const comic = COMIC_STORIES['dusty-pete'];
    assert.ok(comic, 'Dusty Pete comic definition exists');
    assert.equal(comic.panels.length, 4, 'contains exactly 4 panels');
    assert.equal(comic.outlawName, 'Dusty Pete');

    comic.panels.forEach((panel, i) => {
        assert.equal(panel.number, i + 1);
        assert.ok(panel.title.length > 3);
        assert.ok(panel.text.length > 20);
        assert.ok(panel.caption.length > 3);
    });
});

test('hasSeenComic and markComicSeen correctly track viewed state', () => {
    const storage = createMockStorage();
    assert.equal(hasSeenComic('dusty-pete', storage), false);

    markComicSeen('dusty-pete', storage);
    assert.equal(hasSeenComic('dusty-pete', storage), true);
    assert.equal(hasSeenComic('rattlesnake-rosa', storage), false);
});

test('renderComicIntroHtml produces valid overlay markup with 4 panels and start button', () => {
    const html = renderComicIntroHtml('dusty-pete');
    assert.ok(html.includes('comic-intro-modal'));
    assert.ok(html.includes('THE TIN CUP SHAKEDOWN'));
    assert.ok(html.includes('PANEL 1'));
    assert.ok(html.includes('PANEL 4'));
    assert.ok(html.includes('comic-start-btn'));
    assert.ok(html.includes('BEGIN PURSUIT'));

    // Unknown outlaw returns empty string
    assert.equal(renderComicIntroHtml('unknown-outlaw'), '');
});
