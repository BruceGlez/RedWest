// Every sound Red West uses, made with the ElevenLabs API (tools/elevenlabs.mjs) into public/audio/.
// Keys are the file names; the game plays them by key and falls back to its built-in beeps.

import { OUTLAWS } from './outlaws.js';

// Sound effects: text prompt and length in seconds (0.5 to 30; short sounds keep the download small).
export const SFX = {
    'shot-revolver': { prompt: 'Single old west revolver gunshot, sharp crack with a short desert echo, punchy and clean, video game sound effect', seconds: 0.7 },
    'shot-twins': { prompt: 'Quick light pistol shot, snappy pop, small revolver, dry, video game sound effect', seconds: 0.5 },
    'shot-rifle': { prompt: 'Lever-action repeater rifle shot, loud crack with a metallic lever cock after, old west, video game sound effect', seconds: 0.9 },
    'shot-shotgun': { prompt: 'Double-barrel shotgun blast, deep boom with pellet spray, old west, video game sound effect', seconds: 0.9 },
    'shot-sawedoff': { prompt: 'Sawed-off shotgun blast at close range, very loud short boom, video game sound effect', seconds: 0.8 },
    'shot-buffalo': { prompt: 'Huge buffalo hunting rifle shot, massive thunderous boom with long rolling echo across a canyon, video game sound effect', seconds: 1.4 },
    // Variants: the game picks one at random each time, so rapid fire does not repeat itself (src/audio.js, VARIANTS).
    'shot-revolver-2': { prompt: 'Single old west revolver gunshot, sharp crack with a slightly longer desert echo, a bit deeper, video game sound effect', seconds: 0.8 },
    'shot-revolver-3': { prompt: 'Single old west revolver gunshot, bright snappy crack, short tail, video game sound effect', seconds: 0.6 },
    'shot-twins-2': { prompt: 'Quick light pistol shot, dry sharp pop with a small metallic ring, video game sound effect', seconds: 0.5 },
    'shot-rifle-2': { prompt: 'Lever-action repeater rifle shot, deep crack with a short echo and a faint lever click, old west, video game sound effect', seconds: 0.9 },
    'shot-shotgun-2': { prompt: 'Double-barrel shotgun blast, heavy thump with pellet spray and a rolling echo, old west, video game sound effect', seconds: 0.9 },
    'shot-sawedoff-2': { prompt: 'Sawed-off shotgun blast at close range, very short punchy boom with a crackle, video game sound effect', seconds: 0.7 },
    'shot-buffalo-2': { prompt: 'Huge buffalo hunting rifle shot, deep thunderous boom with a long canyon echo, video game sound effect', seconds: 1.4 },
    'hit-2': { prompt: 'Bullet hitting a cartoon bandit, dull punchy thud, satisfying, video game sound effect', seconds: 0.5 },
    'hit-3': { prompt: 'Bullet hitting a cartoon bandit, quick snappy smack, video game sound effect', seconds: 0.5 },
    'enemy-shot': { prompt: 'Distant old west revolver shot, slightly muffled, video game sound effect', seconds: 0.6 },
    'hit': { prompt: 'Bullet hitting a cartoon bandit, punchy thwack impact, satisfying, video game sound effect', seconds: 0.5 },
    'hurt': { prompt: 'Player takes a hit, short grunt of pain from a cowboy with a dull thud, video game sound effect', seconds: 0.6 },
    'clang': { prompt: 'Bullet ricocheting off thick iron armor, loud metallic clang with a whizzing ricochet, video game sound effect', seconds: 0.8 },
    'boom': { prompt: 'Dynamite explosion, big cartoonish boom with dirt and debris, video game sound effect', seconds: 1.5 },
    'fuse': { prompt: 'Lit dynamite fuse sizzling and hissing, short, video game sound effect', seconds: 1.0 },
    'break': { prompt: 'Wooden crate smashing apart, splintering wood, video game sound effect', seconds: 0.7 },
    'powerup': { prompt: 'Magical pickup chime, bright rising sparkle, old west saloon piano flavor, video game sound effect', seconds: 0.8 },
    'coin': { prompt: 'Gold coins jingling into a leather pouch, reward sound, video game sound effect', seconds: 0.8 },
    'heatUp': { prompt: 'Energetic rising whoosh with a guitar twang, power level up, video game sound effect', seconds: 0.8 },
    'heatLost': { prompt: 'Deflating descending whoosh, power lost, short and clear, video game sound effect', seconds: 0.8 },
    'dash': { prompt: 'Quick dash whoosh with jingling cowboy spurs, video game sound effect', seconds: 0.5 },
    'howl': { prompt: 'Wolf howling at night, single long howl, old west desert, video game sound effect', seconds: 2.0 },
    'reload': { prompt: 'Revolver cylinder spinning and six bullets being loaded, clicks, video game sound effect', seconds: 1.5 },
    'outlaw-down': { prompt: 'Dramatic western victory sting, twangy electric guitar and a whip crack, short, video game sound effect', seconds: 2.0 },
    'bounty': { prompt: 'Cash register cha-ching with coins, reward collected, video game sound effect', seconds: 1.2 },
    'click': { prompt: 'Soft wooden button click for a game menu, short', seconds: 0.5 }
};

// Music loops (seconds). Kept short so the game starts fast on phones.
export const MUSIC = {
    'home': { prompt: 'Upbeat spaghetti western theme for a mobile game menu, twangy guitar, whistling melody, light percussion, adventurous and fun, seamless loop, instrumental', seconds: 45 },
    'fight': { prompt: 'Tense fast western action music for a top-down shooter, driving rhythm, twangy electric guitar, galloping drums, energetic, seamless loop, instrumental', seconds: 45 },
    // A hotter fight loop: it takes over from 'fight' while the marshal's Heat is high (setFightIntensity in src/audio.js).
    'fight-hot': { prompt: 'Relentless high-intensity western action music for a top-down shooter, pounding war drums, galloping rhythm, screaming twangy electric guitar, brass stabs, urgent and exciting, seamless loop, instrumental', seconds: 45 },
    'showdown': { prompt: 'Dramatic high-noon showdown music, slow building tension, trumpet mariachi melody over tremolo guitar and war drums, epic boss fight, seamless loop, instrumental', seconds: 40 }
};

// Voice lines. `voice` describes the voice to look for among the account's ElevenLabs voices.
// Each outlaw's line is their ride-in taunt from src/outlaws.js (the banner shows the same words), in a voice that fits them.
const OUTLAW_VOICES = {
    'dusty-pete': 'gruff old man american',
    'rattlesnake-rosa': 'gritty female american',
    'deacon-graves': 'gravelly male american',
    'calloway-gang': 'young male american',
    'iron-jack': 'dominant firm male american',
    'mesa-morgan': 'sassy female american',
    'silas-vane': 'smooth male american',
    'el-espectro': 'dark male latin',
    'lucky-lou': 'smooth confident female american',
    'colonel-crane': 'stern older male american'
};
export const VOICE = {
    'announce-outlaw-down': { text: 'Outlaw down!', voice: 'deep male narrator american' },
    'announce-bounty': { text: 'Bounty claimed!', voice: 'deep male narrator american' },
    'announce-escaped': { text: 'You got away clean!', voice: 'deep male narrator american' },
    'marshal-start': { text: "Time to bring 'em in.", voice: 'confident male american' },
    ...Object.fromEntries(OUTLAWS.map(outlaw => [outlaw.id, { text: outlaw.taunt, voice: OUTLAW_VOICES[outlaw.id] ?? 'gruff male american' }]))
};
