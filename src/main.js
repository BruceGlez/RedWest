import * as THREE from 'three';
import { setupInputs, keys } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { gameState, playerStats } from './state.js';
import { setupScene, generateMap } from './world.js';
import { resumeAudio, getAudioSettings, toggleMusicEnabled, toggleSfxEnabled } from './audio.js';
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
import { buyProduct, waitForCredit } from './purchases.js';
import { loadoutColors, getShopItem, CHARACTERS } from './cosmetics.js';
import { loadCharacterModel, createCharacterInstance } from './characterModels.js';
import { applyPlayerLoadout } from './assets.js';
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
// Outlaws with an imported 3D model: load it for the fight and redraw their WANTED poster from it.
for(const outlaw of OUTLAWS) {
    if(!outlaw.model) continue;
    loadCharacterModel(outlaw.model).then(gltf => {
        const instance = createCharacterInstance(gltf, 6);
        instance.mixer.update(0.4);
        const picture = renderCharacterPortrait(renderer, instance.object);
        if(picture) outlawPortraits[outlaw.id] = picture;
        ui.setPortraits(outlawPortraits, enemyPortraits);
    }).catch(() => {}); // missing file: the box outlaw is used
}
ui.updateHUD();
ui.updateDashBar(1);
if(arena.enabled) ui.showStartScreen(); // the Boss Arena list replaces the home screen

const playerSystem = createPlayerSystem(scene, camera, gameState, playerStats);
// ---------- Economy: wallet, outfit, purchases ----------
const wallet = createWallet();
let profile = cachedProfile();
const records = createRecordsPanel({ wallet, onProfile: next => applyProfile(next), suggestedName: legacyName() });
document.getElementById('records-btn').addEventListener('click', () => records.open());
function applyProfile(next) {
    profile = next;
    records.setProfile(profile);
    const colors = loadoutColors(profile.loadout);
    applyPlayerLoadout(playerSystem.playerGroup, colors);
    playerSystem.setCharacter(getShopItem(profile.loadout.character)).then(() => ui.refreshShop());
    // Guns apply from the next shot (the shop is only open between runs).
    playerStats.guns = { primary: profile.loadout.primary, secondary: profile.loadout.secondary };
    ui.updateHUD();
    setPlayerBulletColor(colors.bullets);
    ui.setProfile(profile);
}
applyProfile(profile);
wallet.load().then(applyProfile).catch(error => ui.shopMessage(error.message, true));
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
    if(item.model) previewCharacter(item.id);
    else ui.setCharacterThumb(item.id, renderPlayerPreview(renderer, loadoutColors(profile.loadout)));
}

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
ui.bindControlHandlers({
    onResumeGame: () => gameLoop.resumeGame(),
    onOpenSettings: () => gameLoop.openSettings(),
    onCloseSettings: () => gameLoop.closeSettings(),
    onRestartRun: () => gameLoop.resetGame(),
    onBankBounty: () => gameLoop.bankAndLeave(),
    onRideOn: () => gameLoop.rideOnToBonus(),
    onPlay: () => { keys.startRequested = true; },
    onBuyItem: async id => {
        try {
            applyProfile(await wallet.buy(id));
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
    onBuyProduct: async productId => {
        try {
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
    }
});
ui.updateAudioControls(getAudioSettings());
gameLoop.start();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('mousedown', resumeAudio);
window.addEventListener('touchend', resumeAudio); // iOS only unlocks audio from a touch gesture

// Installable app: cache the game for offline play. Only on https (GitHub Pages), never in local dev.
if('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* Offline support is optional. */ });
}
