import * as THREE from 'three';
import { setupInputs, keys } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { gameState, playerStats } from './state.js';
import { setupScene, generateMap } from './world.js';
import { audioDownloads, resumeAudio, playSound, getAudioSettings, setMusicVolume, toggleMusicEnabled, toggleSfxEnabled } from './audio.js';
import { createUIManager } from './uiManager.js';
import { createPlayerSystem } from './playerSystem.js';
import { createGameLoop } from './gameLoop.js';
import { loadRunLog, clearRunLog } from './runLog.js';
import { loadProgress, saveProgress, isUnlocked } from './progress.js';
import { renderOutlawPortraits, renderEnemyPortraits, renderEnemyModelPortrait, renderPlayerPreview, renderCharacterPortrait } from './portraits.js';
import { OUTLAWS } from './outlaws.js';
import { arena, beginTownFight } from './arena.js';
import { beginMineRun } from './mine.js';
import { createWallet, cachedProfile, legacyName } from './wallet.js';
import { createRecordsPanel } from './recordsPanel.js';
import { buyProduct, waitForCredit, restorePurchases, lastCredit } from './purchases.js';
import { createPrivacyPanel } from './privacyPanel.js';
import { createTownPanel } from './townPanel.js';
import { disableReminders } from './reminders.js';
import { isChild, canShareStats } from './privacy.js';
import { configureAnalytics, track } from './analytics.js';
import { generatedName } from './names.js';
import { loadoutColors, getShopItem, CHARACTERS } from './cosmetics.js';
import { loadCharacterModel, loadedCharacterModel, createCharacterInstance } from './characterModels.js';
import { WOLF_MODEL, WOLF_MODEL_HEIGHT, attachMissingOutlawModels } from './enemySystem.js';
import { applyPlayerLoadout } from './assets.js';
import { applyPerk } from './perks.js';
import { DEMO, openStore, assetUrl } from './demo.js';
import { setPlayerBulletColor } from './bulletSystem.js';
import { appleSignInMode, authorizeWithApple } from './appleSignIn.js';
import { PORTRAIT_FILES } from './portraitFiles.js';
import { createLoadingScreen } from './loadingScreen.js';

// Entry screen with a loading bar (not in the playable ad, which has its own start card).
const loadingScreen = DEMO ? null : createLoadingScreen();
if(DEMO) document.getElementById('loading-screen')?.remove();
gameState.loading = !DEMO;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const isTouch = setupTouchControls();
// Sharper on phones without paying for full 3x device-pixel rendering.
if(isTouch) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Filmic tone mapping keeps the bright desert colours rich instead of washed out.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
// Dev builds only: lets tests and tools/perf.mjs read draw calls (renderer.info).
if(import.meta.env?.DEV) Object.assign(window, { __redWestRenderer: renderer, __redWestCamera: camera });

setupScene(scene, camera, renderer);
generateMap(scene);
setupInputs();

let ui;
ui = createUIManager(gameState, playerStats);
ui.setRunLog(loadRunLog());
const progress = loadProgress();
ui.setProgress(progress);
// Pictures of the 3D characters ship as files (tools/render-portraits.mjs), so menus never wait on a model.
// (The playable ad is one self-contained file that may load nothing else, so it draws its own pictures instead.)
const portraitFile = name => (!DEMO && PORTRAIT_FILES.has(name) ? assetUrl(`portraits/${name}.webp`) : null);
const outlawPortraits = renderOutlawPortraits(renderer);
for(const outlaw of OUTLAWS) outlawPortraits[outlaw.id] = portraitFile(outlaw.id) ?? outlawPortraits[outlaw.id];
const enemyPortraits = renderEnemyPortraits(renderer);
for(const id of Object.keys(enemyPortraits)) enemyPortraits[id] = portraitFile(`enemy-${id}`) ?? enemyPortraits[id];
ui.setPortraits(outlawPortraits, enemyPortraits);
// Outlaws' 3D models load one at a time (about 1 MB each): the selected outlaw now, others when
// picked. Once loaded, the outlaw fights as the model and their WANTED poster is redrawn from it.
const outlawModelRequests = new Map();
function loadOutlawModel(index) {
    const outlaw = OUTLAWS[index];
    if(!outlaw?.model) return Promise.resolve();
    if(!outlawModelRequests.has(index)) {
        outlawModelRequests.set(index, loadCharacterModel(outlaw.model).then(gltf => {
            const instance = createCharacterInstance(gltf, 6);
            instance.mixer.update(0.4);
            const picture = portraitFile(outlaw.id) ? null : renderCharacterPortrait(renderer, instance.object);
            if(picture) outlawPortraits[outlaw.id] = picture;
            ui.setPortraits(outlawPortraits, enemyPortraits);
            syncOutlawThumbs();
            attachMissingOutlawModels(); // a boss that spawned before this finished downloading gets its model now
        }).catch(() => { outlawModelRequests.delete(index); })); // missing file: the box outlaw is used, and the next request tries again
    }
    return outlawModelRequests.get(index);
}
// The model, with one more try if the first download failed (a flaky phone connection): a fight should not start as the
// plain box figure just because of one dropped download.
async function ensureOutlawModel(index) {
    await loadOutlawModel(index);
    const url = OUTLAWS[index]?.model;
    if(url && !loadedCharacterModel(url)) await loadOutlawModel(index);
}
// The 3D wolf (about 0.6 MB) loads in the background: wolves spawn as the box wolf until it is ready,
// and stay the box wolf if the file is missing. Not needed in the playable ad.
// Once loaded, the NEW ENEMY card and the Bounty Book show the 3D wolf instead of the box one.
if(!DEMO) {
    loadCharacterModel(WOLF_MODEL).then(gltf => {
        const instance = createCharacterInstance(gltf, WOLF_MODEL_HEIGHT);
        instance.mixer.update(0.2);
        const picture = renderEnemyModelPortrait(renderer, instance.object);
        if(picture) {
            enemyPortraits.wolf = picture;
            ui.setPortraits(outlawPortraits, enemyPortraits);
        }
    }).catch(() => {});
}
if(arena.enabled) OUTLAWS.forEach((_, i) => loadOutlawModel(i)); // the arena shows them all
else loadingScreen?.track(loadOutlawModel(progress.selected));
ui.updateHUD();
ui.updateDashBar(1);
if(arena.enabled) ui.showStartScreen(); // the Boss Arena list replaces the home screen

const playerSystem = createPlayerSystem(scene, camera, gameState, playerStats);
if(import.meta.env?.DEV) window.__redWest = { scene, camera, playerGroup: playerSystem.playerGroup }; // for the browser tests (tests/mine-smoke.mjs)
// ---------- Economy: wallet, outfit, purchases ----------
const wallet = createWallet();
let profile = cachedProfile();
const records = createRecordsPanel({ wallet, onProfile: next => applyProfile(next), suggestedName: legacyName() });
document.getElementById('records-btn').addEventListener('click', () => records.open());
const town = createTownPanel({
    wallet,
    getProgress: () => progress,
    onProfile: next => applyProfile(next),
    ui,
    onBuyPass: () => buyRealMoneyProduct('season_pass'),
    isChild: () => isChild(privacyPanel.privacy),
    // Most Wanted: fight this week's event outlaw (its model first), then back to the home screen.
    // The Arena in the town: a practice fight against a boss already beaten on the Wanted Road (its model first).
    portrait: id => outlawPortraits[id],
    onArenaFight: async index => {
        if(!beginTownFight(index, progress)) return;
        ui.hidePanels();
        await ensureOutlawModel(index);
        keys.startRequested = true;
    },
    // The cellar stairs in Mr. Grimsby's parlour: the Hollow Claim, from floor 1. It needs no outlaw model; the mine sends no outlaw.
    onDescend: () => {
        beginMineRun();
        ui.hidePanels();
        keys.startRequested = true;
    },
    // The train at the depot: the same hunt as PLAY, for the outlaw the Wanted Road has selected.
    onBoardTrain: () => {
        ui.hidePanels();
        loadOutlawModel(progress.selected).then(() => { keys.startRequested = true; });
    },
    onRideOut: event => {
        ui.hidePanels();
        gameState.pendingEvent = event;
        loadOutlawModel(event.outlaw).then(() => { keys.startRequested = true; });
    }
});
let profileCharacterTracked = false;
function applyProfile(next) {
    profile = next;
    records.setProfile(profile);
    const colors = loadoutColors(profile.loadout);
    applyPlayerLoadout(playerSystem.playerGroup, colors);
    const characterReady = playerSystem.setCharacter(getShopItem(profile.loadout.character)).then(() => ui.refreshShop());
    if(!profileCharacterTracked) {
        profileCharacterTracked = true;
        loadingScreen?.track(characterReady);
    }
    // Guns apply from the next shot (the shop is only open between runs).
    playerStats.guns = { primary: profile.loadout.primary, secondary: profile.loadout.secondary };
    // An outlaw character brings its perk and drawback (src/perks.js).
    applyPerk(playerStats, getShopItem(profile.loadout.character)?.perk?.mods, gameState.isGameStarted && !gameState.isGameOver);
    ui.updateHUD();
    setPlayerBulletColor(colors.bullets);
    ui.setProfile(profile);
    town.setProfile(profile);
}
applyProfile(profile);
let profileLoaded = false;
wallet.load().then(next => {
    profileLoaded = true;
    applyProfile(next);
    giveChildAName();
    renderApple();
}).catch(error => ui.shopMessage(error.message, true));

document.getElementById('settings-build').textContent = `Build ${typeof __RW_BUILD__ === 'string' ? __RW_BUILD__ : 'dev'}`;

// ---------- Sign in with Apple (optional): keeps the save when changing phones ----------
const appleBtn = document.getElementById('settings-apple-btn');
const appleLabel = document.getElementById('settings-apple-label');
const appleNote = document.getElementById('settings-apple-note');
function renderApple(message) {
    const mode = appleSignInMode();
    appleBtn.style.display = mode ? '' : 'none';
    appleNote.style.display = mode ? '' : 'none';
    if(!mode) return;
    appleBtn.disabled = wallet.apple;
    appleLabel.textContent = wallet.apple ? 'Signed in with Apple' : 'Sign in with Apple';
    appleNote.textContent = message || (wallet.apple
        ? 'Your save is linked to your Apple ID. Sign in with Apple on a new phone to carry on.'
        : 'Keeps your save if you change phones. Only an Apple user id is stored, no name or email. '
            + 'If this Apple ID already has a Red West save, this device switches to that save.');
}
appleBtn.addEventListener('click', async () => {
    appleBtn.disabled = true;
    try {
        const result = await wallet.signInWithApple(authorizeWithApple);
        applyProfile(await wallet.load());
        renderApple(result.switched ? 'Switched to the save linked to this Apple ID.' : '');
    } catch(error) {
        renderApple(/cancel|1001/i.test(error?.message || '') ? '' : error.message); // closing Apple's sheet is not an error
    }
});

// ---------- Privacy: first-launch age question, statistics consent, delete my data ----------
// Nothing starts until the first-launch question is answered (gameLoop checks startBlocked).
const privacyPanel = createPrivacyPanel({
    onChange: applyPrivacy,
    onDelete: async () => {
        await disableReminders(false);
        await wallet.deleteAccount();
        location.reload(); // starts again from the first-launch question
    }
});
function applyPrivacy(privacy) {
    gameState.startBlocked = !privacy;
    if(!privacy) return;
    const child = isChild(privacy);
    ui.setChildMode(child);
    records.setChildMode(child);
    configureAnalytics({ allowed: canShareStats(privacy), sender: wallet.statsSender });
    wallet.setPrivacy(privacy).catch(() => {}); // the server applies the same rules
    giveChildAName();
}
// Players under 13 never type a name: they get a generated one (retrying if it is taken).
let namingChild = false;
async function giveChildAName() {
    if(namingChild || !profileLoaded || profile.name || !isChild(privacyPanel.privacy)) return;
    namingChild = true;
    for(let attempt = 0; attempt < 5 && !profile.name; attempt++) {
        try {
            applyProfile(await wallet.setName(generatedName()));
        } catch(error) {
            if(error.code !== 'name_taken') break;
        }
    }
    namingChild = false;
}
applyPrivacy(privacyPanel.privacy);
if(DEMO) {
    // Playable ad: no home screen, no questions, nothing sent anywhere. A tap starts the fight with Dusty
    // Pete and his gang (the Boss Arena's direct start); src/demo.js shows the end card.
    arena.enabled = true;
    arena.outlaw = 0;
    arena.gang = true;
    gameState.startBlocked = false;
    document.body.classList.add('demo');
    const start = document.getElementById('demo-start');
    start.style.display = 'flex';
    document.getElementById('demo-play').addEventListener('click', () => {
        start.style.display = 'none';
        resumeAudio();
        keys.startRequested = true;
    });
    document.getElementById('demo-store').addEventListener('click', openStore);
} else {
    // Behind the entry screen: sounds, fonts and the character pictures (small files, see portraitFiles.js).
    for(const download of audioDownloads()) loadingScreen.track(download);
    if(document.fonts?.ready) loadingScreen.track(document.fonts.ready);
    for(const name of PORTRAIT_FILES) {
        loadingScreen.track(new Promise(resolve => {
            const image = new Image();
            image.onload = image.onerror = resolve;
            image.src = assetUrl(`portraits/${name}.webp`);
        }));
    }
    loadingScreen.finish()
        .then(() => { gameState.loading = false; })
        .then(() => privacyPanel.ask())
        .then(() => track('session_start'));
}
// Shop preview and character cards: imported characters get their own posed copy once loaded.
const previewCharacters = new Map();
function previewCharacter(id) {
    const item = getShopItem(id);
    if(DEMO || !item?.model) return null; // the ad has no shop, and carries only the marshal's and Pete's models
    if(!previewCharacters.has(id)) {
        previewCharacters.set(id, null);
        loadCharacterModel(item.model).then(gltf => {
            const instance = createCharacterInstance(gltf, 6);
            instance.mixer.update(0.4); // a moment into the idle pose
            instance.object.rotation.y = 0.5;
            previewCharacters.set(id, instance.object);
            ui.setCharacterThumb(id, portraitFile(id) ?? renderPlayerPreview(renderer, null, instance.object));
            ui.refreshShop();
        }).catch(() => {});
    }
    return previewCharacters.get(id);
}
// The big shop picture shows the model once loaded; until then, its picture file (never the wrong character).
ui.setPreviewRenderer(loadout => {
    const model = previewCharacter(loadout.character);
    if(!model && getShopItem(loadout.character)?.model && portraitFile(loadout.character)) return portraitFile(loadout.character);
    return renderPlayerPreview(renderer, loadoutColors(loadout), model);
});
for(const item of CHARACTERS) {
    if(item.model && portraitFile(item.id)) ui.setCharacterThumb(item.id, portraitFile(item.id));
    if(item.unlock) continue; // outlaws' models load only when tried on or picked
    if(item.model) previewCharacter(item.id);
    else ui.setCharacterThumb(item.id, renderPlayerPreview(renderer, loadoutColors(profile.loadout)));
}
function syncOutlawThumbs() {
    for(const item of CHARACTERS) {
        if(item.unlock && !portraitFile(item.id) && !previewCharacters.get(item.id)) ui.setCharacterThumb(item.id, outlawPortraits[OUTLAWS[item.unlock.outlaw].id]);
    }
}
syncOutlawThumbs();

async function afterPayment(before) {
    ui.shopMessage('Payment received. Adding it to your account...');
    const nuggetsBefore = profile.balances.nuggets;
    const credited = await waitForCredit(wallet, before);
    if(credited) {
        applyProfile(credited);
        const added = credited.balances.nuggets - nuggetsBefore;
        ui.shopMessage(`Purchase added${added > 0 ? `: +${added} Gold Nuggets` : ''}. Thank you!`);
    } else {
        ui.shopMessage('Still processing. It will appear shortly; reopen the store to refresh.');
    }
}

// Real-money purchases (nugget packs, the Deputy's Kit, the season pass).
async function buyRealMoneyProduct(productId) {
    try {
        track('purchase_start');
        const before = lastCredit(profile);
        try { sessionStorage.setItem('redWestCreditBefore', before); } catch { /* private mode */ }
        const result = await buyProduct(productId, wallet);
        if(result.purchased) await afterPayment(before);
    } catch(error) {
        // A cancelled store sheet is not an error worth shouting about.
        ui.shopMessage(/cancel/i.test(error.message) ? 'Purchase cancelled.' : error.message, !/cancel/i.test(error.message));
    }
}

// Returning from Stripe checkout (the Payment Link's success URL adds ?purchase=success).
if(new URLSearchParams(location.search).get('purchase') === 'success') {
    history.replaceState(null, '', location.pathname);
    ui.openShop();
    let before = '';
    try { before = sessionStorage.getItem('redWestCreditBefore') || ''; } catch { /* private mode */ }
    afterPayment(before).catch(() => {});
}

const economy = {
    reportRun: summary => wallet.reportRun(summary).then(result => {
        applyProfile(result.profile);
        return result;
    })
};

const gameLoop = createGameLoop(scene, camera, renderer, playerSystem, ui, progress, economy);
gameLoop.setLobbyView(town);
ui.bindControlHandlers({
    onResumeGame: () => gameLoop.resumeGame(),
    onOpenSettings: () => gameLoop.openSettings(),
    onCloseSettings: () => gameLoop.closeSettings(),
    onRestartRun: () => gameLoop.resetGame(),
    onBankBounty: () => gameLoop.bankAndLeave(),
    onRideOn: () => gameLoop.rideOnToBonus(),
    onMineAnswer: yes => gameLoop.answerMine(yes),
    // The arena starts a fight at once, so it waits for that outlaw's model first.
    onPlay: async () => {
        if(arena.enabled) await ensureOutlawModel(arena.outlaw);
        keys.startRequested = true;
    },
    onBuyItem: async id => {
        try {
            applyProfile(await wallet.buy(id));
            playSound('coin');
            ui.shopMessage('Bought! It is yours to keep.');
        } catch(error) {
            ui.shopMessage(error.message, true);
        }
    },
    onEquipItem: async id => {
        try {
            applyProfile(await wallet.equip(id));
            ui.shopMessage('');
        } catch(error) {
            ui.shopMessage(error.message, true);
        }
    },
    onRestorePurchases: async () => {
        try {
            const result = await restorePurchases(wallet);
            applyProfile(result.profile);
            ui.shopMessage(result.restored.length ? "Restored: the Deputy's Kit." : 'Nothing to restore on this account.');
        } catch(error) {
            ui.shopMessage(error.message, true);
        }
    },
    onBuyProduct: productId => buyRealMoneyProduct(productId),
    onSelectOutlaw: index => {
        if(!isUnlocked(progress, index)) return;
        progress.selected = index;
        loadOutlawModel(index);
        saveProgress(progress);
        ui.setProgress(progress);
    },
    onClearRunLog: () => {
        clearRunLog();
        ui.setRunLog([]);
    },
    onToggleMusic: () => {
        toggleMusicEnabled();
        ui.updateAudioControls(getAudioSettings());
    },
    onToggleSfx: () => {
        toggleSfxEnabled();
        ui.updateAudioControls(getAudioSettings());
    },
    onMusicVolume: volume => {
        setMusicVolume(volume);
        ui.updateAudioControls(getAudioSettings());
    }
});
ui.updateAudioControls(getAudioSettings());
gameLoop.start();

// Upright screens get a wider view (with the camera further back, src/gameLoop.js) to see enough arena.
function fitCamera() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = window.innerHeight > window.innerWidth ? 68 : 60;
    camera.updateProjectionMatrix();
}
fitCamera();
window.addEventListener('resize', () => {
    fitCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
// Browsers only allow sound after the player interacts, so the first input starts the menu music.
window.addEventListener('mousedown', resumeAudio);
window.addEventListener('keydown', resumeAudio);
window.addEventListener('touchend', resumeAudio); // iOS only unlocks audio from a touch gesture
// Every menu button clicks.
document.addEventListener('click', event => {
    if(event.target.closest?.('button')) playSound('click');
});

// Installable app: cache the game for offline play. Only on https (GitHub Pages), never in local dev.
if(!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* Offline support is optional. */ });
}
