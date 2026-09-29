import * as THREE from 'three';
import { setupInputs, keys } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { gameState, playerStats } from './state.js';
import { setupScene, generateMap } from './world.js';
import { resumeAudio, playSound, getAudioSettings, setMusicVolume, toggleMusicEnabled, toggleSfxEnabled } from './audio.js';
import { createUIManager } from './uiManager.js';
import { createPlayerSystem } from './playerSystem.js';
import { createGameLoop } from './gameLoop.js';
import { loadRunLog, clearRunLog } from './runLog.js';
import { loadProgress, saveProgress, isUnlocked } from './progress.js';
import { renderOutlawPortraits, renderEnemyPortraits, renderPlayerPreview, renderCharacterPortrait } from './portraits.js';
import { OUTLAWS } from './outlaws.js';
import { arena } from './arena.js';
import { createWallet, cachedProfile, legacyName } from './wallet.js';
import { createRecordsPanel } from './recordsPanel.js';
import { buyProduct, waitForCredit, restorePurchases } from './purchases.js';
import { createPrivacyPanel } from './privacyPanel.js';
import { createTownPanel } from './townPanel.js';
import { disableReminders } from './reminders.js';
import { isChild, canShareStats } from './privacy.js';
import { configureAnalytics, track } from './analytics.js';
import { generatedName } from './names.js';
import { loadoutColors, getShopItem, CHARACTERS } from './cosmetics.js';
import { loadCharacterModel, createCharacterInstance } from './characterModels.js';
import { applyPlayerLoadout } from './assets.js';
import { applyPerk } from './perks.js';
import { setPlayerBulletColor } from './bulletSystem.js';

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

setupScene(scene, camera, renderer);
generateMap(scene);
setupInputs();

let ui;
ui = createUIManager(gameState, playerStats);
ui.setRunLog(loadRunLog());
const progress = loadProgress();
ui.setProgress(progress);
const outlawPortraits = renderOutlawPortraits(renderer);
const enemyPortraits = renderEnemyPortraits(renderer);
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
            const picture = renderCharacterPortrait(renderer, instance.object);
            if(picture) outlawPortraits[outlaw.id] = picture;
            ui.setPortraits(outlawPortraits, enemyPortraits);
            syncOutlawThumbs();
        }).catch(() => {})); // missing file: the box outlaw is used
    }
    return outlawModelRequests.get(index);
}
if(arena.enabled) OUTLAWS.forEach((_, i) => loadOutlawModel(i)); // the arena shows them all
else loadOutlawModel(progress.selected);
ui.updateHUD();
ui.updateDashBar(1);
if(arena.enabled) ui.showStartScreen(); // the Boss Arena list replaces the home screen

const playerSystem = createPlayerSystem(scene, camera, gameState, playerStats);
// ---------- Economy: wallet, outfit, purchases ----------
const wallet = createWallet();
let profile = cachedProfile();
const records = createRecordsPanel({ wallet, onProfile: next => applyProfile(next), suggestedName: legacyName() });
document.getElementById('records-btn').addEventListener('click', () => records.open());
const town = createTownPanel({
    wallet,
    onProfile: next => applyProfile(next),
    ui,
    // Most Wanted: fight this week's event outlaw (its model first), then back to the home screen.
    onRideOut: event => {
        ui.hidePanels();
        gameState.pendingEvent = event;
        loadOutlawModel(event.outlaw).then(() => { keys.startRequested = true; });
    }
});
function applyProfile(next) {
    profile = next;
    records.setProfile(profile);
    const colors = loadoutColors(profile.loadout);
    applyPlayerLoadout(playerSystem.playerGroup, colors);
    playerSystem.setCharacter(getShopItem(profile.loadout.character)).then(() => ui.refreshShop());
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
}).catch(error => ui.shopMessage(error.message, true));

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
privacyPanel.ask().then(() => track('session_start'));
// Shop preview and character cards: imported characters get their own posed copy once loaded.
const previewCharacters = new Map();
function previewCharacter(id) {
    const item = getShopItem(id);
    if(!item?.model) return null;
    if(!previewCharacters.has(id)) {
        previewCharacters.set(id, null);
        loadCharacterModel(item.model).then(gltf => {
            const instance = createCharacterInstance(gltf, 6);
            instance.mixer.update(0.4); // a moment into the idle pose
            instance.object.rotation.y = 0.5;
            previewCharacters.set(id, instance.object);
            ui.setCharacterThumb(id, renderPlayerPreview(renderer, null, instance.object));
            ui.refreshShop();
        }).catch(() => {});
    }
    return previewCharacters.get(id);
}
ui.setPreviewRenderer(loadout => renderPlayerPreview(renderer, loadoutColors(loadout), previewCharacter(loadout.character)));
for(const item of CHARACTERS) {
    if(item.unlock) continue; // outlaws use their WANTED portrait; their model loads only when tried on or picked
    if(item.model) previewCharacter(item.id);
    else ui.setCharacterThumb(item.id, renderPlayerPreview(renderer, loadoutColors(profile.loadout)));
}
function syncOutlawThumbs() {
    for(const item of CHARACTERS) {
        if(item.unlock && !previewCharacters.get(item.id)) ui.setCharacterThumb(item.id, outlawPortraits[OUTLAWS[item.unlock.outlaw].id]);
    }
}
syncOutlawThumbs();

async function afterPayment(before) {
    ui.shopMessage('Payment received. Your nuggets are on the way...');
    const credited = await waitForCredit(wallet, before);
    if(credited) {
        applyProfile(credited);
        ui.shopMessage(`+${credited.balances.nuggets - before} Gold Nuggets added. Thank you!`);
    } else {
        ui.shopMessage('Still processing. Your nuggets will appear shortly; reopen the store to refresh.');
    }
}

// Returning from Stripe checkout (the Payment Link's success URL adds ?purchase=success).
if(new URLSearchParams(location.search).get('purchase') === 'success') {
    history.replaceState(null, '', location.pathname);
    ui.openShop();
    let before = 0;
    try { before = Number(sessionStorage.getItem('redWestNuggetsBefore')) || 0; } catch { /* private mode */ }
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
    // The arena starts a fight at once, so it waits for that outlaw's model first.
    onPlay: async () => {
        if(arena.enabled) await loadOutlawModel(arena.outlaw);
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
    onBuyProduct: async productId => {
        try {
            track('purchase_start');
            const before = profile.balances.nuggets;
            try { sessionStorage.setItem('redWestNuggetsBefore', String(before)); } catch { /* private mode */ }
            const result = await buyProduct(productId, wallet);
            if(result.purchased) await afterPayment(before);
        } catch(error) {
            // A cancelled store sheet is not an error worth shouting about.
            ui.shopMessage(/cancel/i.test(error.message) ? 'Purchase cancelled.' : error.message, !/cancel/i.test(error.message));
        }
    },
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
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
if('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* Offline support is optional. */ });
}
