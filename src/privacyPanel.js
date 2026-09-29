import { CONFIG } from './config.js';
import { ageBandFromYear, birthYearOptions, loadPrivacy, savePrivacy, isChild } from './privacy.js';

// The first-launch question and the privacy controls in Settings: statistics on/off, legal links and
// "Delete my data" (two taps, like every purchase).
export function createPrivacyPanel({ onChange, onDelete }) {
    const $ = id => document.getElementById(id);
    const els = {
        welcome: $('welcome-modal'),
        form: $('welcome-form'),
        year: $('welcome-year'),
        stats: $('welcome-stats'),
        cont: $('welcome-continue'),
        welcomeLegal: $('welcome-legal'),
        statsBtn: $('settings-stats-btn'),
        deleteBtn: $('settings-delete-btn'),
        deleteNote: $('settings-delete-note'),
        settingsLegal: $('settings-legal')
    };
    let privacy = loadPrivacy();
    let confirmingDelete = false;

    const links = [
        CONFIG.privacyUrl && ['Privacy policy', CONFIG.privacyUrl],
        CONFIG.termsUrl && ['Terms', CONFIG.termsUrl],
        CONFIG.supportEmail && ['Support', `mailto:${CONFIG.supportEmail}`]
    ].filter(Boolean);
    for(const box of [els.welcomeLegal, els.settingsLegal]) {
        box.replaceChildren(...links.map(([label, href]) => {
            const a = document.createElement('a');
            a.textContent = label;
            a.href = href;
            if(!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
            return a;
        }));
        box.style.display = links.length ? '' : 'none';
    }

    for(const year of birthYearOptions()) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        els.year.append(option);
    }
    els.year.addEventListener('change', () => { els.cont.disabled = !ageBandFromYear(els.year.value); });

    function render() {
        const child = isChild(privacy);
        els.statsBtn.textContent = child ? 'Share gameplay stats: not for under 13' : `Share gameplay stats: ${privacy?.statsConsent ? 'ON' : 'OFF'}`;
        els.statsBtn.disabled = !privacy || child;
        els.statsBtn.className = privacy?.statsConsent ? '' : 'off';
        els.deleteBtn.textContent = confirmingDelete ? 'CONFIRM: DELETE EVERYTHING' : 'Delete my data';
        els.deleteBtn.className = confirmingDelete ? 'danger' : '';
        els.deleteNote.style.display = confirmingDelete ? '' : 'none';
        els.deleteNote.textContent = 'Deletes your progress, outlaw name, records, items and Gold Nuggets (including bought ones) '
            + 'on this device and on the Red West server. It cannot be undone. Tap anywhere else to cancel.';
    }

    function set(next) {
        privacy = savePrivacy(next) || privacy;
        render();
        onChange(privacy);
    }

    els.statsBtn.addEventListener('click', () => {
        if(!privacy || isChild(privacy)) return;
        set({ ...privacy, statsConsent: !privacy.statsConsent });
    });
    els.deleteBtn.addEventListener('click', async event => {
        event.stopPropagation();
        if(!confirmingDelete) {
            confirmingDelete = true;
            render();
            return;
        }
        els.deleteBtn.disabled = true;
        els.deleteNote.textContent = 'Deleting...';
        try {
            await onDelete();
        } catch(error) {
            els.deleteBtn.disabled = false;
            confirmingDelete = false;
            render();
            els.deleteNote.style.display = '';
            els.deleteNote.textContent = `Could not delete: ${error.message} Try again, or email support.`;
        }
    });
    // Any other tap cancels a pending delete.
    document.addEventListener('click', event => {
        if(confirmingDelete && event.target !== els.deleteBtn) {
            confirmingDelete = false;
            render();
        }
    });

    render();
    return {
        get privacy() { return privacy; },
        // Resolves with the answers, asking first if this device has not answered yet.
        ask() {
            if(privacy) return Promise.resolve(privacy);
            els.welcome.style.display = 'flex';
            return new Promise(resolve => {
                const submit = event => {
                    event.preventDefault();
                    const ageBand = ageBandFromYear(els.year.value);
                    if(!ageBand) return;
                    els.form.removeEventListener('submit', submit);
                    els.welcome.style.display = 'none';
                    set({ ageBand, statsConsent: els.stats.checked });
                    resolve(privacy);
                };
                els.form.addEventListener('submit', submit);
            });
        }
    };
}
