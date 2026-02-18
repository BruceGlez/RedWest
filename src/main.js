import * as THREE from 'three';
import { setupInputs } from './input.js';
import { gameState, playerStats } from './state.js';
import { setupScene, generateMap } from './world.js';
import { resumeAudio } from './audio.js';
import { loadHighScores, saveHighScore, getPreferredPlayerName } from './scoreSystem.js';
import { createUIManager } from './uiManager.js';
import { createPlayerSystem } from './playerSystem.js';
import { createGameLoop } from './gameLoop.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

setupScene(scene, camera, renderer);
generateMap(scene);
setupInputs();

let ui;
ui = createUIManager(gameState, playerStats, (name, score) => {
    const scores = saveHighScore(name, score);
    ui.updateLeaderboard(scores);
});
ui.updateLeaderboard(loadHighScores());
ui.setPreferredName(getPreferredPlayerName());
ui.updateHUD();
ui.updateDashBar(1);

const playerSystem = createPlayerSystem(scene, camera, gameState, playerStats);
const gameLoop = createGameLoop(scene, camera, renderer, playerSystem, ui);
gameLoop.start();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('mousedown', resumeAudio);
