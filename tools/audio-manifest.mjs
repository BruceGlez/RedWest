// Every sound Red West uses, made with the ElevenLabs API (tools/elevenlabs.mjs) into public/audio/.
// Keys are the file names; the game plays them by key and falls back to its built-in beeps.

// Sound effects: text prompt and length in seconds (short sounds keep the download small).
export const SFX = {
    'shot-revolver': { prompt: 'Single old west revolver gunshot, sharp crack with a short desert echo, punchy and clean, video game sound effect', seconds: 0.7 },
    'shot-twins': { prompt: 'Quick light pistol shot, snappy pop, small revolver, dry, video game sound effect', seconds: 0.5 },
    'shot-rifle': { prompt: 'Lever-action repeater rifle shot, loud crack with a metallic lever cock after, old west, video game sound effect', seconds: 0.9 },
    'shot-shotgun': { prompt: 'Double-barrel shotgun blast, deep boom with pellet spray, old west, video game sound effect', seconds: 0.9 },
    'shot-sawedoff': { prompt: 'Sawed-off shotgun blast at close range, very loud short boom, video game sound effect', seconds: 0.8 },
    'shot-buffalo': { prompt: 'Huge buffalo hunting rifle shot, massive thunderous boom with long rolling echo across a canyon, video game sound effect', seconds: 1.4 },
    'enemy-shot': { prompt: 'Distant old west revolver shot, slightly muffled, video game sound effect', seconds: 0.6 },
    'hit': { prompt: 'Bullet hitting a cartoon bandit, punchy thwack impact, satisfying, video game sound effect', seconds: 0.4 },
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
    'click': { prompt: 'Soft wooden button click for a game menu, short', seconds: 0.3 }
};

// Music loops (seconds). Kept short so the game starts fast on phones.
export const MUSIC = {
    'home': { prompt: 'Upbeat spaghetti western theme for a mobile game menu, twangy guitar, whistling melody, light percussion, adventurous and fun, seamless loop, instrumental', seconds: 45 },
    'fight': { prompt: 'Tense fast western action music for a top-down shooter, driving rhythm, twangy electric guitar, galloping drums, energetic, seamless loop, instrumental', seconds: 45 },
    'showdown': { prompt: 'Dramatic high-noon showdown music, slow building tension, trumpet mariachi melody over tremolo guitar and war drums, epic boss fight, seamless loop, instrumental', seconds: 40 }
};

// Voice lines. `voice` describes the voice to look for among the account's ElevenLabs voices.
const OUTLAW_VOICE = 'gruff old man american';
export const VOICE = {
    'announce-outlaw-down': { text: 'Outlaw down!', voice: 'deep male narrator american' },
    'announce-bounty': { text: 'Bounty claimed!', voice: 'deep male narrator american' },
    'announce-escaped': { text: 'You got away clean!', voice: 'deep male narrator american' },
    'marshal-start': { text: "Time to bring 'em in.", voice: 'confident male american' },
    'dusty-pete': { text: "You lookin' for a fight? You found one!", voice: OUTLAW_VOICE },
    'rattlesnake-rosa': { text: 'The pack is hungry tonight.', voice: 'gritty female american' },
    'deacon-graves': { text: 'Judgment comes at high noon.', voice: 'gravelly male american' },
    'calloways': { text: 'There are a whole lot more of us, Marshal!', voice: 'young male american' },
    'iron-jack': { text: "Go on. Shoot me. See what happens.", voice: 'dominant firm male american' },
    'mesa-morgan': { text: 'Hope you like fireworks!', voice: 'sassy female american' },
    'silas-vane': { text: 'Six shots. That is all I need.', voice: 'smooth male american' },
    'el-espectro': { text: 'You cannot kill what is already dead.', voice: 'dark male latin' }
};
