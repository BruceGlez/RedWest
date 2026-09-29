import { heatMultiplier, CHAIN_WINDOW, MAX_HEAT } from './heat.js';
import { FINAL_PURSUIT } from './bounty.js';
import { formatRunLog } from './runLog.js';
import { OUTLAWS, MODIFIERS, STAR_GOALS, getOutlaw } from './outlaws.js';
import { ENEMY_TYPES, ENEMY_ORDER } from './enemyTypes.js';
import { SHOP_ITEMS, SLOTS, SLOT_LABELS, getShopItem, loadoutColors } from './cosmetics.js';
import { getWeapon, defaultWeapon, weaponBars } from './weapons.js';
import { getJob, ALL_JOBS_BONUS_NUGGETS } from './jobs.js';
import { PRODUCTS } from './products.js';
import { track } from './analytics.js';
import { purchaseSupport } from './purchases.js';
import { arena } from './arena.js';
import { isUnlocked, totalStars, starsForRun, starCount } from './progress.js';

export function createUIManager(gameState, playerStats) {
    let waveBannerTimeoutId = null;
    let heatEventTimeoutId = null;
    let lastHeatLevel = 0;
    let runLog = [];
    let progress = null;
    let portraits = {};
    let enemyPortraits = {};
    let newEnemyTimeoutId = null;
    let profile = null;
    let renderPreview = null;
    let shopTab = 'character';
    const characterThumbs = {};
    let tryOn = null; // item previewed but not equipped
    let confirmId = null;
    let childMode = false; // under 13 (src/privacy.js): no real-money packs
    let confirmTimeoutId = null;
    let shopHandlers = {};
    const els = {
        score: document.getElementById('score'),
        wave: document.getElementById('wave'),
        waveTimer: document.getElementById('wave-timer'),
        weaponLabel: document.getElementById('weapon-label'),
        heatLevel: document.getElementById('heat-level'),
        heatMultiplier: document.getElementById('heat-multiplier'),
        heatRow: document.getElementById('heat-row'),
        heatEvent: document.getElementById('heat-event'),
        heatChain: document.getElementById('heat-chain'),
        heatChainFill: document.getElementById('heat-chain-fill'),
        health: document.getElementById('health-container'),
        status: document.getElementById('status-msg'),
        waveBanner: document.getElementById('wave-banner'),
        dashBar: document.getElementById('dash-bar'),
        pauseOverlay: document.getElementById('pause-overlay'),
        pauseResumeBtn: document.getElementById('pause-resume-btn'),
        pauseSettingsBtn: document.getElementById('pause-settings-btn'),
        settingsModal: document.getElementById('settings-modal'),
        settingsMusicBtn: document.getElementById('settings-music-btn'),
        settingsSfxBtn: document.getElementById('settings-sfx-btn'),
        settingsMusicVolume: document.getElementById('settings-music-volume'),
        settingsMusicVolumeValue: document.getElementById('settings-music-volume-value'),
        settingsResumeBtn: document.getElementById('settings-resume-btn'),
        settingsRestartBtn: document.getElementById('settings-restart-btn'),
        settingsCloseBtn: document.getElementById('settings-close-btn'),
        startScreen: document.getElementById('start-screen'),
        gameOver: document.getElementById('gameover'),
        finalScore: document.getElementById('finalScore'),
        resultTitle: document.getElementById('result-title'),
        resultDetail: document.getElementById('result-detail'),
        resultRoad: document.getElementById('result-road'),
        homePoster: document.getElementById('home-poster'),
        dashBtn: document.getElementById('btn-dash'),
        swapBtn: document.getElementById('btn-swap'),
        homeStars: document.getElementById('home-stars'),
        roadStars: document.getElementById('road-stars'),
        roadProgress: document.getElementById('road-progress'),
        roadTrack: document.getElementById('road-track'),
        playBtn: document.getElementById('play-btn'),
        roadBtn: document.getElementById('road-btn'),
        recordsBtn: document.getElementById('records-btn'),
        howtoBtn: document.getElementById('howto-btn'),
        homeSettingsBtn: document.getElementById('home-settings-btn'),
        starGoals: document.getElementById('star-goals'),
        panels: ['road-screen', 'records-screen', 'howto-screen', 'book-screen', 'shop-screen', 'jobs-screen', 'town-screen'].map(id => document.getElementById(id)),
        bookBtn: document.getElementById('book-btn'),
        bookProgress: document.getElementById('book-progress'),
        bookEnemies: document.getElementById('book-enemies'),
        bookOutlaws: document.getElementById('book-outlaws'),
        bookCount: document.getElementById('book-count'),
        bookTotal: document.getElementById('book-total'),
        newEnemyCard: document.getElementById('new-enemy-card'),
        shopBtn: document.getElementById('shop-btn'),
        jobsBtn: document.getElementById('jobs-btn'),
        jobsProgress: document.getElementById('jobs-progress'),
        homeDollars: document.getElementById('home-dollars'),
        homeNuggets: document.getElementById('home-nuggets'),
        shopDollars: document.getElementById('shop-dollars'),
        shopNuggets: document.getElementById('shop-nuggets'),
        shopTabs: document.getElementById('shop-tabs'),
        shopGrid: document.getElementById('shop-grid'),
        shopMessage: document.getElementById('shop-message'),
        shopPreviewImg: document.getElementById('shop-preview-img'),
        shopPreviewLabel: document.getElementById('shop-preview-label'),
        jobsList: document.getElementById('jobs-list'),
        jobsBonus: document.getElementById('jobs-bonus'),
        jobsReset: document.getElementById('jobs-reset'),
        resultEarnings: document.getElementById('result-earnings'),
        bountyChoice: document.getElementById('bounty-choice'),
        bountyAmount: document.getElementById('bounty-amount'),
        bountyHeat: document.getElementById('bounty-heat'),
        bonusSeconds: document.getElementById('bonus-seconds'),
        bankAmount: document.getElementById('bank-amount'),
        bankTotal: document.getElementById('bank-total'),
        bankStars: document.getElementById('bank-stars'),
        rideAmount: document.getElementById('ride-amount'),
        rideStars: document.getElementById('ride-stars'),
        rideKeep: document.getElementById('ride-keep'),
        bonusHud: document.getElementById('bonus-hud'),
        bankBountyBtn: document.getElementById('bankBountyBtn'),
        rideOnBtn: document.getElementById('rideOnBtn'),
        runLogCount: document.getElementById('run-log-count'),
        runLogStatus: document.getElementById('run-log-status'),
        copyRunLogBtn: document.getElementById('copyRunLogBtn'),
        clearRunLogBtn: document.getElementById('clearRunLogBtn'),
        resultCopyLogBtn: document.getElementById('resultCopyLogBtn'),
        restartMsg: document.getElementById('restart-msg'),
        debugPanel: document.getElementById('debug-panel'),
        runStatsTable: document.getElementById('run-stats-table')
    };

    let restartTimer = 0;

    if(els.starGoals) els.starGoals.innerHTML = STAR_GOALS.map(goal => `<li>${goal}</li>`).join('');

    function updateHUD() {
        const hearts = [];
        for(let i = 0; i < playerStats.maxHp; i++) {
            if(i < playerStats.hp) hearts.push('&#10084;');
            else hearts.push('<span class="heart-dim">&#10084;</span>');
        }
        els.health.innerHTML = hearts.join('');
        els.score.innerText = gameState.score;
        els.wave.innerText = gameState.waveNumber > FINAL_PURSUIT ? 'BONUS' : gameState.waveNumber;
        const held = getWeapon(playerStats.guns[playerStats.weapon]) || defaultWeapon(playerStats.weapon);
        els.weaponLabel.innerText = held.short;
        if(els.swapBtn && els.swapBtn.dataset.weapon !== held.id) {
            els.swapBtn.dataset.weapon = held.id;
            els.swapBtn.innerHTML = `SWAP<small>${held.short}</small>`;
        }
        updateHeat(gameState.heat);

        if(gameState.isIntermission) {
            els.waveTimer.innerText = `BREAK ${Math.ceil(gameState.intermissionTimer)}s`;
            els.status.className = '';
            els.status.innerText = 'GET READY FOR NEXT WAVE';
            return;
        }

        // Riding on: keep the goal and the stake on screen the whole time.
        const riding = gameState.bounty.status === 'riding';
        els.bonusHud.style.display = riding ? 'block' : 'none';
        if(riding) {
            els.bonusHud.innerHTML = `SURVIVE <b>${Math.ceil(Math.max(0, gameState.waveTimer))}s</b> <span>${gameState.bounty.amount} BOUNTY AT STAKE</span>`;
        }

        els.waveTimer.innerText = (gameState.waveBossSpawned && gameState.waveTimer <= 0)
            ? 'OUTLAW'
            : `${Math.ceil(Math.max(0, gameState.waveTimer))}s`;
        if(playerStats.tripleShotTimer > 0) {
            els.status.className = 'status-power';
            els.status.innerText = `TRIPLE SHOT: ${Math.ceil(playerStats.tripleShotTimer)}s`;
        } else {
            els.status.className = '';
            els.status.innerText = '';
        }
    }

    function updateHeat(heat) {
        els.heatLevel.innerText = heat.level;
        els.heatMultiplier.innerText = `x${heatMultiplier(heat.level).toFixed(1)}`;
        // Row glows hotter with each level; the bar shows time left to extend the chain.
        for(let level = 0; level <= MAX_HEAT; level++) els.heatRow.classList.toggle(`heat-${level}`, level === heat.level);
        els.heatChain.classList.toggle('active', heat.chainTimer > 0);
        els.heatChainFill.style.width = `${Math.max(0, Math.min(1, heat.chainTimer / CHAIN_WINDOW)) * 100}%`;
        if(heat.level < lastHeatLevel && heat.level > 0 && !heatEventTimeoutId) showHeatEvent('cooling');
        lastHeatLevel = heat.level;
    }

    const HEAT_EVENTS = {
        up: 'HEAT UP',
        broken: 'CHAIN BROKEN',
        cooling: 'COOLING',
        lost: 'HEAT LOST'
    };

    function showHeatEvent(kind) {
        els.heatEvent.textContent = HEAT_EVENTS[kind] || '';
        els.heatRow.classList.remove('pulse-up', 'pulse-down');
        void els.heatRow.offsetWidth; // restart the CSS animation
        els.heatRow.classList.add(kind === 'up' ? 'pulse-up' : 'pulse-down');
        if(heatEventTimeoutId) clearTimeout(heatEventTimeoutId);
        heatEventTimeoutId = setTimeout(() => {
            els.heatEvent.textContent = '';
            heatEventTimeoutId = null;
        }, 1200);
    }

    function updateDashBar(percent) {
        // Phones show the cooldown as a ring filling around the DASH button.
        els.dashBtn?.style.setProperty('--cooldown', String(Math.max(0, Math.min(1, percent))));
        els.dashBtn?.classList.toggle('ready', percent >= 1);
        els.dashBar.style.width = `${Math.max(0, Math.min(1, percent)) * 100}%`;
        els.dashBar.className = percent >= 1 ? 'dash-ready' : 'dash-cooldown';
    }

    function showWaveBanner(text, durationMs = 1800) {
        if(!els.waveBanner) return;
        els.waveBanner.innerText = text;
        els.waveBanner.style.display = 'block';
        if(waveBannerTimeoutId) clearTimeout(waveBannerTimeoutId);
        waveBannerTimeoutId = setTimeout(() => {
            els.waveBanner.style.display = 'none';
            waveBannerTimeoutId = null;
        }, durationMs);
    }

    function renderRunStats() {
        if(!els.runStatsTable) return;
        const s = gameState.runStats;
        const accuracy = s.shotsFired > 0 ? `${Math.round((s.shotsHit / s.shotsFired) * 100)}%` : '0%';
        const rows = [
            ['Pursuit reached', s.waveReached > FINAL_PURSUIT ? 'BONUS' : s.waveReached],
            ['Outlaw bounty', describeBounty(gameState.bounty)],
            ['Peak Heat', gameState.heat.peak],
            ['Enemies destroyed', s.enemiesKilled],
            ...ENEMY_ORDER.filter(id => s.kills[id]).map(id => [`${ENEMY_TYPES[id].name[0]}${ENEMY_TYPES[id].name.slice(1).toLowerCase()}s bagged`, s.kills[id]]),
            ['Bosses destroyed', s.bossesKilled],
            ['Shots fired', s.shotsFired],
            ['Shot accuracy', accuracy],
            ['Damage taken', s.damageTaken],
            ['Obstacles destroyed', s.obstaclesDestroyed],
            ['Loot collected', s.lootCollected],
            ['Whiskey picked up', s.whiskeyCollected],
            ['Ammo picked up', s.ammoCollected]
        ];
        els.runStatsTable.innerHTML = '';
        for(const [label, value] of rows) {
            const tr = document.createElement('tr');
            const tdLabel = document.createElement('td');
            const tdValue = document.createElement('td');
            tdLabel.textContent = label;
            tdValue.textContent = value;
            tr.appendChild(tdLabel);
            tr.appendChild(tdValue);
            els.runStatsTable.appendChild(tr);
        }
    }

    function describeBounty(bounty) {
        if(bounty.status === 'banked') return `+${bounty.amount} (banked)`;
        if(bounty.status === 'escaped') return `+${bounty.amount} (escaped)`;
        if(bounty.status === 'forfeited') return `${bounty.amount} lost`;
        return 'not claimed';
    }

    const RESULT_TEXT = {
        banked: ['BOUNTY CLAIMED', 'You took the bounty and rode out.'],
        escaped: ['ESCAPED', 'You outran the posse with the bounty.'],
        died: ['WASTED', ''],
        'arena-win': ['OUTLAW DOWN', 'Practice fight won.']
    };

    // result: 'died' | 'banked' | 'escaped'; roadResult: what the run changed on the Wanted Road
    function showGameOver(result = 'died', roadResult = null) {
        els.bonusHud.style.display = 'none';
        hidePauseOverlay();
        hideSettingsModal();
        const [title, detail] = RESULT_TEXT[result] || RESULT_TEXT.died;
        els.resultTitle.textContent = title;
        els.resultTitle.classList.toggle('wasted-text', result === 'died');
        els.resultDetail.textContent = gameState.bounty.status === 'forfeited'
            ? `You rode on and didn't make it: the ${gameState.bounty.amount} bounty and the extra points are lost. You kept ${gameState.score.toLocaleString()}.`
            : detail;
        renderRoadResult(roadResult);
        els.resultEarnings.innerHTML = '<p class="earn-title">Counting your earnings...</p>';
        els.gameOver.style.display = 'flex';
        els.finalScore.innerText = gameState.score;
        renderRunStats();
        // A short beat before RETURN TO TOWN, so a held key or stray tap cannot skip the result.
        els.restartMsg.style.display = 'none';
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { els.restartMsg.style.display = 'block'; }, 800);
        // Start at the top so the stars and result are seen before the long run report.
        const panel = els.gameOver.querySelector('.modal-content');
        if(panel) panel.scrollTop = 0;
    }

    // Spell out both outcomes in points and stars, so the choice needs no rules reading.
    function showBountyChoice(bounty, bonusSeconds) {
        hidePauseOverlay();
        hideSettingsModal();
        const score = gameState.score;
        const had = progress?.stars[gameState.outlawIndex] ?? 0;
        const newStars = status => {
            const count = starCount(starsForRun({ status, heatAtOffer: bounty.heatAtOffer }) & ~had);
            return count ? `+${count} new star${count > 1 ? 's' : ''} &#9733;` : '';
        };
        els.bountyAmount.textContent = bounty.amount;
        els.bankAmount.textContent = bounty.amount;
        els.bankTotal.textContent = (score + bounty.amount).toLocaleString();
        els.bankStars.innerHTML = newStars('banked');
        els.rideAmount.textContent = bounty.amount;
        els.rideStars.innerHTML = newStars('escaped');
        els.rideKeep.textContent = score.toLocaleString();
        els.bountyHeat.textContent = `${bounty.heatAtOffer} (x${heatMultiplier(bounty.heatAtOffer).toFixed(1)})`;
        els.bonusSeconds.textContent = bonusSeconds;
        els.bountyChoice.style.display = 'flex';
    }

    function hideBountyChoice() {
        if(els.bountyChoice) els.bountyChoice.style.display = 'none';
    }

    // ---------- Home screen and Wanted Road (all markup below comes from static outlaw data) ----------
    const hex = color => `#${color.toString(16).padStart(6, '0')}`;

    function starsHtml(mask) {
        return [1, 2, 4].map(bit => `<span class="star${mask & bit ? ' on' : ''}">&#9733;</span>`).join('');
    }

    function portraitHtml(outlaw) {
        if(portraits[outlaw.id]) {
            return `<div class="portrait portrait-render"><img src="${portraits[outlaw.id]}" alt="${outlaw.name}"></div>`;
        }
        const c = outlaw.colors;
        return `<div class="portrait" style="--coat:${hex(c.coat)};--poncho:${hex(c.hat ?? c.poncho)};--bandana:${hex(c.bandana)}">`
            + '<div class="p-body"></div><div class="p-head"><div class="p-eyes"></div><div class="p-bandana"></div></div>'
            + '<div class="p-hat-brim"></div><div class="p-hat-top"></div></div>';
    }

    function posterHtml(index) {
        const outlaw = OUTLAWS[index];
        // The outlaw's own attack first, then the gang's threats.
        const threats = `<span class="threat signature" title="${outlaw.signature.detail}">&#9733; ${outlaw.signature.move}</span>`
            + outlaw.modifiers.map(id => `<span class="threat" title="${MODIFIERS[id].detail}">${MODIFIERS[id].label}</span>`).join('');
        return '<div class="poster-wanted">WANTED</div><div class="poster-sub">DEAD OR ALIVE</div>'
            + portraitHtml(outlaw)
            + `<div class="poster-name">${outlaw.name}</div><div class="poster-title">${outlaw.title}</div>`
            + `<div class="poster-threats">${threats}</div><div class="poster-reward">REWARD $${outlaw.bounty}</div>`
            + `<div class="poster-footer"><span class="poster-stars">${starsHtml(progress.stars[index])}</span>`
            + `<span class="poster-stage">STAGE ${index + 1}/${OUTLAWS.length}</span></div>`;
    }

    function renderRoad() {
        els.roadTrack.innerHTML = OUTLAWS.map((outlaw, i) => {
            const unlocked = isUnlocked(progress, i);
            const classes = ['road-node', unlocked ? '' : 'locked', i === progress.selected ? 'selected' : ''].join(' ').trim();
            return `<button type="button" class="${classes}" data-index="${i}"${unlocked ? '' : ' disabled'}>`
                + `<span class="road-num">${i + 1}</span>${portraitHtml(outlaw)}`
                + `<span class="road-name">${outlaw.name}</span><span class="road-stars">${starsHtml(progress.stars[i])}</span>`
                + `<span class="road-reward">$${outlaw.bounty}</span>${unlocked ? '' : '<span class="road-lock">LOCKED</span>'}</button>`;
        }).join('<span class="road-link" aria-hidden="true"></span>');
    }

    // ---------- Economy: balances, shop, daily jobs, earnings ----------
    const hexColor = color => `#${color.toString(16).padStart(6, '0')}`;
    const priceLabel = item => (item.currency === 'nuggets' ? `&#9670;${item.price}` : `$${item.price}`);
    const owns = id => { const item = getShopItem(id); return !!item && (item.price === 0 || profile.owned.includes(id)); };

    function setProfile(nextProfile) {
        profile = nextProfile;
        const { dollars, nuggets } = profile.balances;
        for(const el of [els.homeDollars, els.shopDollars]) el.textContent = dollars.toLocaleString();
        for(const el of [els.homeNuggets, els.shopNuggets]) el.textContent = nuggets.toLocaleString();
        const done = profile.jobs.list.filter(j => j.done).length;
        els.jobsProgress.textContent = `${done} / ${profile.jobs.list.length} DONE`;
        els.jobsBtn.classList.toggle('attention', done < profile.jobs.list.length);
        if(els.panels[4].style.display !== 'none') renderShop();
        if(els.panels[5].style.display !== 'none') renderJobs();
    }

    function updatePreview() {
        if(!renderPreview || !profile) return;
        const loadout = { ...profile.loadout };
        if(tryOn) loadout[tryOn.slot] = tryOn.id;
        // Outfit colours only show on the Drifter, so try them on the Drifter.
        if(tryOn && ['hat', 'coat', 'pants'].includes(tryOn.slot)) loadout.character = 'char-drifter';
        els.shopPreviewImg.src = renderPreview(loadout);
        els.shopPreviewLabel.textContent = tryOn && !owns(tryOn.id) ? `TRYING ON: ${tryOn.name.toUpperCase()}`
            : tryOn ? tryOn.name.toUpperCase() : 'YOUR OUTFIT';
    }

    function shopMessage(text, isError = false) {
        els.shopMessage.textContent = text;
        els.shopMessage.classList.toggle('error', isError);
    }

    function renderShop() {
        const tabs = [...SLOTS.map(slot => [slot, SLOT_LABELS[slot]]), ['nuggets', '&#9670; NUGGETS']];
        els.shopTabs.innerHTML = tabs.map(([id, label]) => `<button type="button" class="shop-tab${shopTab === id ? ' active' : ''}" data-tab="${id}">${label}</button>`).join('');
        if(shopTab === 'nuggets' && childMode) {
            els.shopGrid.innerHTML = '<p class="shop-fineprint">Gold Nugget packs are not sold to players under 13. '
                + 'You still earn Gold Nuggets by finishing all your daily jobs.</p>';
            return;
        }
        if(shopTab === 'nuggets') {
            els.shopGrid.innerHTML = PRODUCTS.map(product => {
                const support = purchaseSupport(product.id);
                const pending = confirmId === product.id;
                return `<div class="shop-card nugget-card">${product.badge ? `<span class="shop-badge">${product.badge}</span>` : ''}`
                    + `<div class="nugget-icon">&#9670;</div><div class="shop-name">${product.nuggets.toLocaleString()} NUGGETS</div>`
                    + `<div class="shop-sub">${product.label}</div>`
                    + `<button type="button" class="shop-action${pending ? ' confirm' : ''}" data-product="${product.id}"${support.available ? '' : ' disabled'}>`
                    + `${pending ? `CONFIRM ${product.price}` : support.available ? product.price : 'SOON'}</button></div>`;
            }).join('') + `<p class="shop-fineprint">${purchaseSupport(PRODUCTS[0].id).available
                ? 'Real money. You will confirm in the App Store / checkout before being charged. Under 18? Ask a parent first.'
                : purchaseSupport(PRODUCTS[0].id).reason} Gold Nuggets are also earned by finishing all daily jobs.</p>`;
            return;
        }
        const outfitNote = ['hat', 'coat', 'pants'].includes(shopTab) && getShopItem(profile.loadout.character)?.model
            ? '<p class="shop-fineprint">Hats, coats and pants show on The Drifter (CHARACTERS tab).</p>' : '';
        els.shopGrid.innerHTML = SHOP_ITEMS.filter(item => item.slot === shopTab).map(item => {
            const owned = owns(item.id);
            const equipped = profile.loadout[item.slot] === item.id;
            const pending = confirmId === item.id;
            const action = equipped ? 'EQUIPPED' : owned ? 'EQUIP' : pending ? `CONFIRM ${priceLabel(item)}` : priceLabel(item);
            // Characters show their picture, guns what they do (bars + trade-off), looks a colour swatch.
            const top = item.slot === 'character'
                ? `<div class="char-thumb">${characterThumbs[item.id] ? `<img src="${characterThumbs[item.id]}" alt="">` : '<span>LOADING</span>'}</div>`
                : item.stats
                ? `<div class="gun-bars">${Object.entries(weaponBars(item)).map(([label, value]) => `<div class="gun-bar"><span>${label}</span><i style="--fill:${value * 20}%"></i></div>`).join('')}</div>`
                : `<div class="shop-swatch${item.slot === 'bullets' ? ' bullet' : ''}" style="--swatch:${hexColor(item.color)}"></div>`;
            return `<div class="shop-card${item.stats ? ' gun-card' : ''}${tryOn?.id === item.id ? ' trying' : ''}" data-try="${item.id}">`
                + top
                + `<div class="shop-name">${item.name}</div>`
                + (item.blurb ? `<div class="shop-sub gun-blurb">${item.blurb}</div>` : '')
                + `<button type="button" class="shop-action${equipped ? ' equipped' : ''}${pending ? ' confirm' : ''}${item.currency === 'nuggets' && !owned ? ' nugget' : ''}" data-item="${item.id}"${equipped ? ' disabled' : ''}>${action}</button></div>`;
        }).join('') + outfitNote;
    }

    // tab: optionally open on one shop tab (the town's Gunsmith and Tailor do).
    function openShop(tab) {
        track('shop_open');
        if(typeof tab === 'string' && (SLOTS.includes(tab) || tab === 'nuggets')) shopTab = tab;
        tryOn = null;
        confirmId = null;
        shopMessage('');
        showPanel(els.panels[4]);
        renderShop();
        updatePreview();
    }

    // Two taps to spend anything: the first arms a CONFIRM button (no one-tap purchases).
    function armConfirm(id) {
        confirmId = id;
        if(confirmTimeoutId) clearTimeout(confirmTimeoutId);
        confirmTimeoutId = setTimeout(() => { confirmId = null; renderShop(); }, 4000);
        renderShop();
    }

    async function onShopClick(event) {
        const tab = event.target.closest('[data-tab]');
        if(tab) {
            shopTab = tab.dataset.tab;
            confirmId = null;
            renderShop();
            return;
        }
        const productButton = event.target.closest('[data-product]');
        if(productButton) {
            const id = productButton.dataset.product;
            if(confirmId !== id) return armConfirm(id);
            confirmId = null;
            renderShop();
            shopMessage('Opening checkout...');
            await shopHandlers.onBuyProduct?.(id);
            return;
        }
        const itemButton = event.target.closest('[data-item]');
        if(itemButton) {
            const item = getShopItem(itemButton.dataset.item);
            if(owns(item.id)) {
                await shopHandlers.onEquipItem?.(item.id);
                tryOn = null;
            } else if(confirmId !== item.id) {
                // Show it on the player first (looks only), then start the confirm window.
                tryOn = item.stats ? null : item;
                updatePreview();
                armConfirm(item.id);
                return;
            } else {
                confirmId = null;
                await shopHandlers.onBuyItem?.(item.id);
            }
            renderShop();
            updatePreview();
            return;
        }
        const card = event.target.closest('[data-try]');
        if(card) {
            const item = getShopItem(card.dataset.try);
            if(item?.stats) return;
            tryOn = item;
            renderShop();
            updatePreview();
        }
    }

    function msUntilMidnight() {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return midnight - now;
    }

    function renderJobs() {
        els.jobsList.innerHTML = profile.jobs.list.map(entry => {
            const job = getJob(entry.id);
            const pct = Math.min(100, Math.round((entry.progress / job.goal) * 100));
            return `<div class="job-card${entry.done ? ' done' : ''}"><div class="job-text">${job.text}</div>`
                + `<div class="job-bar"><div class="job-fill" style="width:${pct}%"></div></div>`
                + `<div class="job-meta"><span>${Math.min(entry.progress, job.goal)} / ${job.goal}</span><span class="job-reward">${entry.done ? 'PAID' : `+$${job.reward}`}</span></div></div>`;
        }).join('');
        els.jobsBonus.innerHTML = profile.jobs.bonusPaid
            ? `All jobs done today: <b>+&#9670;${ALL_JOBS_BONUS_NUGGETS} paid</b>. Come back tomorrow.`
            : `Finish all three for a bonus of <b>&#9670;${ALL_JOBS_BONUS_NUGGETS} Gold Nuggets</b>.`;
        const hours = Math.floor(msUntilMidnight() / 3600000);
        const minutes = Math.floor((msUntilMidnight() % 3600000) / 60000);
        els.jobsReset.textContent = `NEW JOBS IN ${hours}h ${minutes}m`;
    }

    function showEarnings(result, error = null) {
        if(error) {
            els.resultEarnings.innerHTML = `<p class="earn-error">Earnings not saved: ${error}</p>`;
            return;
        }
        const lines = result.lines.map(line => `<li><span>${line.label}</span><b>${line.nuggets ? `+&#9670;${line.nuggets}` : `+$${line.dollars}`}</b></li>`).join('');
        els.resultEarnings.innerHTML = `<p class="earn-title">EARNED <b>$${result.dollars}</b>${result.nuggets ? ` <b>&#9670;${result.nuggets}</b>` : ''}</p><ul class="earn-lines">${lines}</ul>`;
    }

    // ---------- Bounty Book ----------
    const pips = (value, max, symbol = '&#9632;') => Array.from({ length: max }, (_, i) => `<span class="pip${i < value ? ' on' : ''}">${symbol}</span>`).join('');
    const toughness = hp => Math.min(5, hp <= 3 ? hp : hp <= 5 ? 4 : 5);
    const quickness = speed => (speed <= 4 ? 1 : speed <= 6 ? 2 : speed <= 8 ? 3 : speed <= 11 ? 4 : 5);

    function bookPicture(id, seen) {
        if(!enemyPortraits[id]) return '<div class="book-pic book-pic-empty">?</div>';
        return `<div class="book-pic${seen ? '' : ' unknown'}"><img src="${enemyPortraits[id]}" alt=""></div>`;
    }

    function renderBook() {
        const seenCount = ENEMY_ORDER.filter(id => progress.seen[id]).length;
        els.bookProgress.textContent = `${seenCount} / ${ENEMY_ORDER.length} FOUND`;
        els.bookCount.textContent = seenCount;
        els.bookTotal.textContent = ENEMY_ORDER.length;
        els.bookEnemies.innerHTML = ENEMY_ORDER.map(id => {
            const def = ENEMY_TYPES[id];
            const seen = !!progress.seen[id];
            const boss = getOutlaw(def.stage).name;
            const from = def.stage === 0 ? 'Every gang' : `${boss}${boss.endsWith('S') ? '\'' : '\'s'} gang`;
            if(!seen) {
                return `<div class="book-card locked">${bookPicture(id, false)}<div class="book-info"><h4>???</h4>`
                    + `<p class="book-from">Rides with stage ${def.stage + 1} and beyond</p><p>Not met yet.</p></div></div>`;
            }
            return `<div class="book-card">${bookPicture(id, true)}<div class="book-info"><h4>${def.name}</h4>`
                + `<p class="book-from">${from}</p><p>${def.blurb}</p><p class="book-tip"><b>TIP</b> ${def.tip}</p>`
                + `<div class="book-stats"><span>TOUGH ${pips(toughness(def.hp), 5)}</span><span>SPEED ${pips(quickness(def.speed), 5)}</span>`
                + `<span>DANGER ${pips(def.danger, 3, '&#9760;')}</span></div>`
                + `<p class="book-kills">BAGGED: <b>${progress.kills[id] || 0}</b></p></div></div>`;
        }).join('');
        els.bookOutlaws.innerHTML = OUTLAWS.map((outlaw, i) => {
            const unlocked = isUnlocked(progress, i);
            const defeated = (progress.stars[i] & 1) !== 0;
            const status = defeated ? 'DEFEATED' : unlocked ? 'AT LARGE' : 'LOCKED';
            return `<div class="book-card outlaw${unlocked ? '' : ' locked'}">${portraitHtml(outlaw)}<div class="book-info">`
                + `<h4>${unlocked ? outlaw.name : '???'}</h4><p class="book-from">${unlocked ? outlaw.title : `Stage ${i + 1}`}</p>`
                + (unlocked ? `<p class="book-tip"><b>${outlaw.signature.move}:</b> ${outlaw.signature.detail}</p>` : '')
                + `<p class="book-status ${defeated ? 'done' : ''}">${status}</p>`
                + `<p class="poster-stars">${starsHtml(progress.stars[i])}</p></div></div>`;
        }).join('');
    }

    function showNewEnemy(type) {
        const def = ENEMY_TYPES[type];
        if(!def || !els.newEnemyCard) return;
        els.newEnemyCard.innerHTML = `${bookPicture(type, true)}<div><div class="new-enemy-label">NEW ENEMY!</div>`
            + `<div class="new-enemy-name">${def.name}</div><div class="new-enemy-tip">${def.tip}</div></div>`;
        els.newEnemyCard.style.display = 'flex';
        els.newEnemyCard.classList.remove('show');
        void els.newEnemyCard.offsetWidth;
        els.newEnemyCard.classList.add('show');
        if(newEnemyTimeoutId) clearTimeout(newEnemyTimeoutId);
        newEnemyTimeoutId = setTimeout(() => { els.newEnemyCard.style.display = 'none'; }, 4200);
    }

    function setPortraits(images, enemyImages = {}) {
        portraits = images || {};
        enemyPortraits = enemyImages || {};
        if(progress) setProgress(progress);
        if(arena.enabled && arenaEls.screen.style.display !== 'none') renderArena();
    }

    function setProgress(nextProgress) {
        progress = nextProgress;
        const stars = totalStars(progress);
        els.homeStars.textContent = stars;
        els.roadStars.textContent = stars;
        document.querySelectorAll('.stars-max').forEach(el => { el.textContent = OUTLAWS.length * 3; });
        els.roadProgress.textContent = `STAGE ${progress.selected + 1} / ${OUTLAWS.length}`;
        els.homePoster.innerHTML = posterHtml(progress.selected);
        renderRoad();
        renderBook();
    }

    function showPanel(panel) {
        for(const p of els.panels) p.style.display = p === panel ? 'flex' : 'none';
        if(panel === els.panels[0]) {
            els.roadTrack.querySelector('.selected')?.scrollIntoView({ inline: 'center', block: 'nearest' });
        }
    }

    function hidePanels() {
        for(const p of els.panels) p.style.display = 'none';
    }

    function renderRoadResult(roadResult) {
        if(!roadResult || !progress) {
            els.resultRoad.innerHTML = '';
            return;
        }
        const index = gameState.outlawIndex;
        const mask = progress.stars[index];
        const goals = STAR_GOALS.map((goal, k) => {
            const bit = 1 << k;
            const isNew = (roadResult.newStars & bit) !== 0;
            const cls = isNew ? 'new' : (mask & bit ? 'on' : '');
            return `<li class="${cls}"><span class="star">&#9733;</span> ${goal}${isNew ? ' <b>NEW!</b>' : ''}</li>`;
        }).join('');
        const unlock = roadResult.unlockedNext
            ? `<p class="unlock-note">NEW OUTLAW ON THE ROAD: ${getOutlaw(index + 1).name}</p>`
            : '';
        els.resultRoad.innerHTML = `<p class="result-outlaw">${getOutlaw(index).name}</p><ul class="result-goals">${goals}</ul>${unlock}`;
    }

    function setRunLog(records) {
        runLog = records;
        if(els.runLogCount) els.runLogCount.textContent = `${records.length} run${records.length === 1 ? '' : 's'}`;
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Clipboard API unavailable (e.g. plain http): fall back to a temporary selection.
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand('copy');
            area.remove();
            return copied;
        }
    }

    async function copyRunLog(button) {
        button.blur(); // Space starts/restarts the game; keep it from re-pressing this button.
        const copied = runLog.length ? await copyText(formatRunLog(runLog)) : false;
        const message = !runLog.length ? 'NO RUNS LOGGED YET' : copied ? `COPIED ${runLog.length} RUNS` : 'COPY FAILED';
        if(els.runLogStatus) els.runLogStatus.textContent = message;
        button.dataset.label = button.dataset.label || button.textContent;
        button.textContent = message;
        setTimeout(() => { button.textContent = button.dataset.label; }, 1500);
    }

    // ---------- Boss Arena (?arena): pick an outlaw, fight at once, nothing saved ----------
    const arenaEls = {
        screen: document.getElementById('arena-screen'),
        list: document.getElementById('arena-list'),
        invincible: document.getElementById('arena-invincible'),
        gang: document.getElementById('arena-gang')
    };

    function renderArena() {
        arenaEls.invincible.textContent = `CAN'T DIE: ${arena.invincible ? 'ON' : 'OFF'}`;
        arenaEls.invincible.classList.toggle('active', arena.invincible);
        arenaEls.gang.textContent = `GANG: ${arena.gang ? 'ON' : 'OFF'}`;
        arenaEls.gang.classList.toggle('active', arena.gang);
        arenaEls.list.innerHTML = OUTLAWS.map((outlaw, i) => `<div class="book-card outlaw arena-card">${portraitHtml(outlaw)}<div class="book-info">`
            + `<h4>${outlaw.name}</h4><p class="book-from">Stage ${i + 1} &middot; ${outlaw.title}</p>`
            + `<p class="book-tip"><b>${outlaw.signature.move}:</b> ${outlaw.signature.detail}</p>`
            + `<button class="arena-fight" type="button" data-arena="${i}">FIGHT</button></div></div>`).join('');
    }

    function showPracticeResult() {
        els.resultRoad.innerHTML = '';
        els.resultEarnings.innerHTML = '<p class="earn-title">Boss Arena: practice only, nothing is saved.</p>';
    }

    function showStartScreen() {
        if(arena.enabled) {
            els.startScreen.style.display = 'none';
            arenaEls.screen.style.display = 'flex';
            renderArena();
            hideNewEnemy();
            document.body.classList.add('in-lobby');
            return;
        }
        els.startScreen.style.display = 'flex';
        hideNewEnemy();
        document.body.classList.add('in-lobby');
    }

    function hideNewEnemy() {
        if(els.newEnemyCard) els.newEnemyCard.style.display = 'none';
    }

    function hideStartScreen() {
        els.startScreen.style.display = 'none';
        arenaEls.screen.style.display = 'none';
        document.body.classList.remove('in-lobby');
        hidePanels();
        closeHomeSettings();
    }

    function hideGameOverScreen() {
        els.gameOver.style.display = 'none';
    }

    function canRestart() {
        return els.restartMsg.style.display !== 'none';
    }

    function showPauseOverlay() {
        if(els.pauseOverlay) els.pauseOverlay.style.display = 'block';
    }

    function hidePauseOverlay() {
        if(els.pauseOverlay) els.pauseOverlay.style.display = 'none';
    }

    function showSettingsModal() {
        if(els.settingsModal) els.settingsModal.style.display = 'flex';
    }

    function hideSettingsModal() {
        if(els.settingsModal) els.settingsModal.style.display = 'none';
    }

    // Settings opened from the home screen: sound and playtest options only, no resume/restart.
    function openHomeSettings() {
        els.settingsModal.classList.add('home-mode');
        els.settingsModal.style.display = 'flex';
    }

    function closeHomeSettings() {
        if(!els.settingsModal.classList.contains('home-mode')) return;
        els.settingsModal.classList.remove('home-mode');
        els.settingsModal.style.display = 'none';
    }

    function bindControlHandlers(handlers) {
        if(els.pauseResumeBtn) els.pauseResumeBtn.addEventListener('click', handlers.onResumeGame);
        if(els.pauseSettingsBtn) els.pauseSettingsBtn.addEventListener('click', handlers.onOpenSettings);
        if(els.settingsCloseBtn) els.settingsCloseBtn.addEventListener('click', handlers.onCloseSettings);
        if(els.settingsResumeBtn) els.settingsResumeBtn.addEventListener('click', handlers.onResumeGame);
        if(els.settingsRestartBtn) els.settingsRestartBtn.addEventListener('click', handlers.onRestartRun);
        if(els.settingsMusicBtn) els.settingsMusicBtn.addEventListener('click', handlers.onToggleMusic);
        if(els.settingsSfxBtn) els.settingsSfxBtn.addEventListener('click', handlers.onToggleSfx);
        els.settingsMusicVolume?.addEventListener('input', () => handlers.onMusicVolume(Number(els.settingsMusicVolume.value) / 100));
        els.settingsCloseBtn?.addEventListener('click', closeHomeSettings);
        els.homeSettingsBtn.addEventListener('click', openHomeSettings);
        els.playBtn.addEventListener('click', () => {
            els.playBtn.blur();
            handlers.onPlay();
        });
        arenaEls.list.addEventListener('click', event => {
            const button = event.target.closest('[data-arena]');
            if(!button) return;
            arena.outlaw = Number(button.dataset.arena);
            handlers.onPlay();
        });
        arenaEls.invincible.addEventListener('click', () => { arena.invincible = !arena.invincible; renderArena(); });
        arenaEls.gang.addEventListener('click', () => { arena.gang = !arena.gang; renderArena(); });
        els.roadBtn.addEventListener('click', () => showPanel(els.panels[0]));
        els.recordsBtn.addEventListener('click', () => showPanel(els.panels[1]));
        els.howtoBtn.addEventListener('click', () => showPanel(els.panels[2]));
        els.bookBtn.addEventListener('click', () => showPanel(els.panels[3]));
        els.shopBtn.addEventListener('click', openShop);
        els.jobsBtn.addEventListener('click', () => { showPanel(els.panels[5]); renderJobs(); });
        els.shopTabs.addEventListener('click', onShopClick);
        els.shopGrid.addEventListener('click', onShopClick);
        shopHandlers = handlers;
        document.querySelectorAll('.panel-back').forEach(btn => btn.addEventListener('click', hidePanels));
        els.roadTrack.addEventListener('click', event => {
            const node = event.target.closest('.road-node');
            if(!node || node.disabled) return;
            handlers.onSelectOutlaw(Number(node.dataset.index));
            hidePanels();
        });
        if(els.bankBountyBtn) els.bankBountyBtn.addEventListener('click', handlers.onBankBounty);
        if(els.rideOnBtn) els.rideOnBtn.addEventListener('click', handlers.onRideOn);
        els.copyRunLogBtn?.addEventListener('click', () => copyRunLog(els.copyRunLogBtn));
        els.resultCopyLogBtn?.addEventListener('click', () => copyRunLog(els.resultCopyLogBtn));
        els.clearRunLogBtn?.addEventListener('click', () => {
            els.clearRunLogBtn.blur();
            if(!runLog.length || !window.confirm(`Delete all ${runLog.length} logged runs from this browser?`)) return;
            handlers.onClearRunLog();
            if(els.runLogStatus) els.runLogStatus.textContent = 'LOG CLEARED';
        });
    }

    function updateAudioControls(settings) {
        if(els.settingsMusicBtn) {
            els.settingsMusicBtn.textContent = `Music: ${settings.musicEnabled ? 'ON' : 'OFF'}`;
            els.settingsMusicBtn.className = settings.musicEnabled ? '' : 'off';
        }
        if(els.settingsSfxBtn) {
            els.settingsSfxBtn.textContent = `SFX: ${settings.sfxEnabled ? 'ON' : 'OFF'}`;
            els.settingsSfxBtn.className = settings.sfxEnabled ? '' : 'off';
        }
        if(els.settingsMusicVolume) {
            const percent = Math.round(settings.musicVolume * 100);
            els.settingsMusicVolume.value = percent;
            els.settingsMusicVolume.disabled = !settings.musicEnabled;
            if(els.settingsMusicVolumeValue) els.settingsMusicVolumeValue.textContent = `${percent}%`;
        }
    }

    function updateDebug(debugData) {
        if(!els.debugPanel) return;
        els.debugPanel.textContent =
`FPS: ${debugData.fps}
Enemies: ${debugData.enemies}
Obstacles: ${debugData.obstacles}
Loot: ${debugData.loot}
Bullets: ${debugData.bulletsActive} / pool ${debugData.bulletsPooled}
Particles: ${debugData.particlesActive} / pool ${debugData.particlesPooled}
Respawns queued: ${debugData.pendingRespawns}
Grid cells: O=${debugData.obstacleCells} E=${debugData.enemyCells}
Grid dirty: ${debugData.obstacleGridDirty ? 'yes' : 'no'}`;
    }

    return {
        updateHUD,
        updateDashBar,
        showWaveBanner,
        showGameOver,
        showBountyChoice,
        showHeatEvent,
        setRunLog,
        setProgress,
        setPortraits,
        setProfile,
        shopMessage,
        showEarnings,
        openShop,
        openJobs() {
            showPanel(els.panels[5]);
            renderJobs();
        },
        showTown() {
            showPanel(els.panels[6]);
        },
        setChildMode(on) {
            childMode = !!on;
            if(els.panels[4].style.display !== 'none') renderShop();
        },
        setPreviewRenderer: fn => { renderPreview = fn; },
        setCharacterThumb: (id, src) => { if(src) characterThumbs[id] = src; },
        refreshShop: () => { if(profile && els.panels[4].style.display !== 'none') { renderShop(); updatePreview(); } },
        showNewEnemy,
        hideBountyChoice,
        hideGameOverScreen,
        showStartScreen,
        hideStartScreen,
        showPracticeResult,
        canRestart,
        updateDebug,
        bindControlHandlers,
        updateAudioControls,
        showPauseOverlay,
        hidePauseOverlay,
        showSettingsModal,
        hideSettingsModal
    };
}
