import { OUTLAWS } from './outlaws.js';
import { BOARDS } from './profile.js';
import { starCount } from './progress.js';
import { NAME_MAX } from './names.js';

// Records screen: the account's outlaw name, its personal records, and the online leaderboards.
// Leaderboards rank accounts (like Brawl Stars trophies), never per-run name entries.
export function createRecordsPanel({ wallet, onProfile, suggestedName = '' }) {
    const $ = id => document.getElementById(id);
    const els = {
        screen: $('records-screen'),
        nameValue: $('records-name-value'),
        nameShow: document.querySelector('.records-name-show'),
        nameForm: $('records-name-form'),
        nameInput: $('records-name-input'),
        nameEdit: $('records-name-edit'),
        nameCancel: $('records-name-cancel'),
        nameMsg: $('records-name-msg'),
        tabs: $('records-tabs'),
        mine: $('records-mine'),
        boards: $('records-boards'),
        totals: $('records-totals'),
        stages: $('records-stages'),
        boardSelect: $('records-board'),
        boardDetail: $('records-board-detail'),
        boardList: $('records-board-list')
    };
    let profile = null;
    let tab = 'mine';
    let board = 'weekly';
    let request = 0;

    els.nameInput.maxLength = NAME_MAX;
    els.boardSelect.innerHTML = Object.entries(BOARDS)
        .map(([id, b]) => `<option value="${id}">${id.startsWith('stage-') ? `OUTLAW: ${b.label}` : b.label}</option>`)
        .join('');

    const text = (tag, value, className) => {
        const el = document.createElement(tag);
        el.textContent = value;
        if(className) el.className = className;
        return el;
    };

    function showNameForm(open) {
        els.nameShow.style.display = open ? 'none' : 'flex';
        els.nameForm.style.display = open ? 'flex' : 'none';
        if(open) {
            els.nameInput.value = profile?.name || suggestedName;
            els.nameInput.focus({ preventScroll: true });
        }
    }

    function renderName() {
        els.nameValue.textContent = profile?.name || 'NO NAME YET';
        els.nameEdit.textContent = profile?.name ? 'EDIT' : 'PICK A NAME';
        els.nameEdit.classList.toggle('active', !profile?.name);
    }

    function renderMine() {
        const s = profile.stats;
        const stars = s.stageStars.reduce((sum, mask) => sum + starCount(mask), 0);
        els.totals.replaceChildren(...[
            ['BEST RUN', s.bestScore.toLocaleString()],
            ['WANTED STARS', `${stars} / ${OUTLAWS.length * 3}`],
            ['RUNS', s.runs.toLocaleString()],
            ['KILLS', s.kills.toLocaleString()]
        ].map(([label, value]) => {
            const box = text('div', '', 'records-stat');
            box.append(text('strong', value), text('span', label));
            return box;
        }));
        els.stages.replaceChildren(...OUTLAWS.map((outlaw, i) => {
            const li = document.createElement('li');
            const mask = s.stageStars[i];
            li.append(
                text('span', `${i + 1}. ${outlaw.name}`, 'records-who'),
                text('span', [1, 2, 4].map(bit => (mask & bit ? '★' : '☆')).join(''), 'records-stars'),
                text('span', s.stageBest[i] ? s.stageBest[i].toLocaleString() : '—', 'records-value')
            );
            return li;
        }));
    }

    function boardRow(entry) {
        const li = document.createElement('li');
        li.classList.toggle('me', !!entry.me);
        li.append(text('span', `#${entry.rank}`, 'records-rank'), text('span', entry.name, 'records-who'), text('span', entry.value.toLocaleString(), 'records-value'));
        return li;
    }

    async function renderBoards() {
        els.boardSelect.value = board;
        els.boardDetail.textContent = BOARDS[board].detail;
        els.boardList.replaceChildren();
        if(!wallet.online) {
            els.boardDetail.textContent = 'Leaderboards go live when the game is connected to the Red West server. Your records are saved on this device.';
            return;
        }
        const ticket = ++request;
        els.boardList.replaceChildren(text('li', 'LOADING...', 'records-empty'));
        try {
            const data = await wallet.leaderboard(board);
            if(ticket !== request) return;
            const rows = data.entries.map(boardRow);
            if(!rows.length) rows.push(text('li', 'NO ONE HAS A RECORD HERE YET', 'records-empty'));
            // Always show where I stand, even outside the top of the board.
            if(data.me && !data.entries.some(e => e.me)) rows.push(text('li', '⋯', 'records-gap'), boardRow({ ...data.me, me: true }));
            els.boardList.replaceChildren(...rows);
            if(!profile?.name) els.boardDetail.textContent = `${BOARDS[board].detail}. Pick a name to appear here.`;
            else if(!data.me) els.boardDetail.textContent = `${BOARDS[board].detail}. Finish a run here to get on the board.`;
        } catch(error) {
            if(ticket === request) els.boardList.replaceChildren(text('li', error.message, 'records-empty'));
        }
    }

    function render() {
        if(!profile) return;
        renderName();
        for(const button of els.tabs.querySelectorAll('[data-tab]')) button.classList.toggle('active', button.dataset.tab === tab);
        els.mine.style.display = tab === 'mine' ? 'block' : 'none';
        els.boards.style.display = tab === 'boards' ? 'block' : 'none';
        if(tab === 'mine') renderMine();
        else renderBoards();
    }

    els.nameEdit.addEventListener('click', () => { els.nameMsg.textContent = ''; showNameForm(true); });
    els.nameCancel.addEventListener('click', () => { els.nameMsg.textContent = ''; showNameForm(false); });
    els.nameForm.addEventListener('submit', async event => {
        event.preventDefault();
        els.nameMsg.textContent = 'SAVING...';
        try {
            onProfile(await wallet.setName(els.nameInput.value));
            els.nameMsg.textContent = '';
            showNameForm(false);
        } catch(error) {
            els.nameMsg.textContent = error.message;
        }
    });
    els.tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-tab]');
        if(!button) return;
        tab = button.dataset.tab;
        render();
    });
    els.boardSelect.addEventListener('change', () => { board = els.boardSelect.value; render(); });

    return {
        setProfile(next) {
            profile = next;
            if(els.screen.style.display !== 'none') render();
        },
        open() {
            showNameForm(false);
            els.nameMsg.textContent = '';
            render();
        }
    };
}
