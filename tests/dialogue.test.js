import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogue, createDialogueView, MAX_LINE } from '../src/dialogue.js';
import { keys, touch } from '../src/input.js';
import { setInteractHint, mountInteractButton, resetInteractButton } from '../src/interactButton.js';

// A stand-in for the page: just enough of the DOM for the view.
function fakeDoc() {
    const make = tag => ({ tag, style: {}, children: [], listeners: {}, textContent: '', className: '', id: '',
        append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
        addEventListener(type, fn) { this.listeners[type] = fn; } });
    const doc = { body: make('body'), createElement: make };
    return doc;
}

test('a dialogue shows its lines one at a time and ends after the last', () => {
    const d = createDialogue();
    let done = 0;
    assert.equal(d.isOpen(), false);
    assert.equal(d.open({ speaker: 'Odell', lines: ['One.', 'Two.', 'Three.'], onDone: () => { done++; } }), true);
    assert.deepEqual([d.current().speaker, d.current().text, d.current().index, d.current().count], ['Odell', 'One.', 0, 3]);
    assert.equal(d.advance(), true);
    assert.equal(d.current().text, 'Two.');
    assert.equal(d.advance(), true);
    assert.equal(d.advance(), false, 'the last line closes it');
    assert.equal(d.isOpen(), false);
    assert.equal(done, 1);
});

test('skip finishes the whole dialogue, dismiss does not count as finished', () => {
    const d = createDialogue();
    let done = 0;
    d.open({ speaker: 'A', lines: ['x', 'y'], onDone: () => { done++; } });
    d.skip();
    assert.equal(done, 1);
    d.open({ speaker: 'A', lines: ['x', 'y'], onDone: () => { done++; } });
    d.dismiss();
    assert.equal(done, 1, 'walking away does not run onDone');
    assert.equal(d.isOpen(), false);
});

test('a line is cut at the limit and empty dialogues are refused', () => {
    const d = createDialogue();
    assert.equal(d.open({ speaker: 'A', lines: [] }), false);
    assert.equal(d.open({ speaker: 'A', lines: ['   '.trim()] }), false);
    d.open({ speaker: 'A', lines: ['x'.repeat(500)] });
    assert.equal(d.current().text.length, MAX_LINE);
    d.reset();
});

test('a dialogue tied to a place closes when the marshal walks away from it', () => {
    const d = createDialogue();
    d.open({ speaker: 'A', lines: ['hello'], closeAt: { x: 0, z: 0, r: 10 } });
    d.update(5, 5);
    assert.equal(d.isOpen(), true);
    d.update(30, 0);
    assert.equal(d.isOpen(), false);
});

test('lines can name their own speaker', () => {
    const d = createDialogue();
    d.open({ speaker: 'Narrator', lines: ['plain', { speaker: 'Odell', text: 'mine' }] });
    assert.equal(d.current().speaker, 'Narrator');
    d.advance();
    assert.equal(d.current().speaker, 'Odell');
});

test('the view draws the box, advances on a tap and skips on the skip button', () => {
    const doc = fakeDoc();
    const d = createDialogue();
    const view = createDialogueView(doc, d);
    d.setView(view);
    assert.equal(view.element.style.display, 'none');
    d.open({ speaker: 'Odell', lines: ['a', 'b'] });
    assert.equal(view.element.style.display, 'block');
    const [name, text, hint, skip] = view.element.children;
    assert.equal(name.textContent, 'Odell');
    assert.equal(text.textContent, 'a');
    assert.ok(hint.textContent.includes('1/2'));
    view.element.listeners.click({ target: view.element });
    assert.equal(text.textContent, 'b');
    view.element.listeners.click({ target: skip });
    assert.equal(view.element.style.display, 'none');
    assert.equal(d.isOpen(), false);
});

test('the ACT button shows only on touch screens, and sets the interact flag', () => {
    resetInteractButton();
    const doc = fakeDoc();
    touch.enabled = false;
    setInteractHint('OPEN DOOR', doc);
    const button = doc.body.children[0];
    assert.equal(button.style.display, 'none', 'a keyboard player sees the HUD prompt, not a button');
    touch.enabled = true;
    setInteractHint('OPEN DOOR', doc);
    assert.equal(button.style.display, 'block');
    assert.equal(button.textContent, 'OPEN DOOR');
    keys.interactRequested = false;
    button.listeners.pointerdown({ preventDefault() {} });
    assert.equal(keys.interactRequested, true);
    setInteractHint(null, doc);
    assert.equal(button.style.display, 'none');
    keys.interactRequested = false;
    touch.enabled = false;
    resetInteractButton();
});
