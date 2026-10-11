// A dialogue box for story moments (docs/design/stage-world-framework.md, 2.4, and pete-section1-gameplay.md, section 8): a speaker's name and
// one short line at a time (up to MAX_LINE characters), tap or press E to go on, a SKIP button for the lot. The game does not stop behind it:
// a dialogue is only started in a safe place (a campfire), and it closes itself when the marshal walks away (closeAt).
//
// The logic (the queue, advancing, skipping) is a plain object so it tests without a browser; the view draws it into the page.

export const MAX_LINE = 200;

export function createDialogue() {
    let session = null;
    let view = null;
    const api = {
        setView(v) { view = v; if(view) view.render(api.current()); },
        // lines: an array of strings (or { speaker, text }). Long lines are cut at MAX_LINE so a box never overflows a phone.
        open({ speaker = '', lines = [], onDone = null, closeAt = null, id = null } = {}) {
            const items = lines.map(l => typeof l === 'string' ? { speaker, text: l } : { speaker: l.speaker ?? speaker, text: l.text ?? '' })
                .map(l => ({ ...l, text: l.text.length > MAX_LINE ? `${l.text.slice(0, MAX_LINE - 1)}…` : l.text }))
                .filter(l => l.text.length > 0);
            if(!items.length) return false;
            session = { items, index: 0, onDone, closeAt, id };
            view?.render(api.current());
            return true;
        },
        isOpen: () => !!session,
        id: () => session?.id ?? null,
        current: () => session ? { ...session.items[session.index], index: session.index, count: session.items.length } : null,
        // Next line, or close after the last one. Returns true while the box is still open.
        advance() {
            if(!session) return false;
            session.index++;
            if(session.index >= session.items.length) { api.close(true); return false; }
            view?.render(api.current());
            return true;
        },
        skip() { if(session) api.close(true); },
        // Close without finishing (the marshal walked away): onDone does not run.
        dismiss() { api.close(false); },
        close(finished) {
            if(!session) return;
            const done = session.onDone;
            session = null;
            view?.render(null);
            if(finished && done) done();
        },
        // Called once a frame with the marshal's place: a dialogue tied to a spot closes when he leaves it.
        update(x, z) {
            const c = session?.closeAt;
            if(c && Math.hypot(c.x - x, c.z - z) > c.r) api.dismiss();
        },
        reset() { session = null; view?.render(null); }
    };
    return api;
}

// The page view: one box at the bottom of the screen. `doc` is injected so a test can pass a stand-in.
export function createDialogueView(doc, dialogue) {
    const box = doc.createElement('div');
    box.id = 'dialogue-box';
    box.className = 'dialogue-box';
    box.style.display = 'none';
    const name = doc.createElement('div'); name.className = 'dialogue-name';
    const text = doc.createElement('div'); text.className = 'dialogue-text';
    const hint = doc.createElement('div'); hint.className = 'dialogue-hint';
    const skip = doc.createElement('button'); skip.className = 'dialogue-skip'; skip.type = 'button'; skip.textContent = 'SKIP';
    box.append(name, text, hint, skip);
    box.addEventListener('click', e => { if(e.target === skip) dialogue.skip(); else dialogue.advance(); });
    doc.body.appendChild(box);
    return {
        element: box,
        render(state) {
            if(!state) { box.style.display = 'none'; return; }
            name.textContent = state.speaker;
            text.textContent = state.text;
            hint.textContent = state.index + 1 < state.count ? `E or tap: next (${state.index + 1}/${state.count})` : 'E or tap: close';
            box.style.display = 'block';
        }
    };
}

// The one dialogue the game uses.
export const dialogue = createDialogue();
export function mountDialogue(doc = globalThis.document) {
    if(!doc || !doc.body) return null;
    const view = createDialogueView(doc, dialogue);
    dialogue.setView(view);
    return view;
}
