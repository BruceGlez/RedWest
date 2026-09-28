// Make the game's audio with the ElevenLabs API from src/audioManifest.js into public/audio/.
//
//   export ELEVENLABS_API_KEY=...   (set it in the environment's settings; never commit it)
//   node tools/elevenlabs.mjs [sfx|music|voice|all] [--only key,key] [--force]
//
// Existing files are kept unless --force. Needs network access to api.elevenlabs.io.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { SFX, MUSIC, VOICE } from '../src/audioManifest.js';

const API = 'https://api.elevenlabs.io';
const headers = () => ({ 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' });

async function post(path, body) {
    const response = await fetch(`${API}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    if(!response.ok) {
        const text = await response.text();
        throw new Error(`ElevenLabs ${path} failed (${response.status}): ${text.slice(0, 300)}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

const exists = file => access(file).then(() => true, () => false);

async function save(dir, key, data) {
    await mkdir(`public/audio/${dir}`, { recursive: true });
    const file = `public/audio/${dir}/${key}.mp3`;
    await writeFile(file, data);
    console.log(`  ${file} (${Math.round(data.length / 1024)} KB)`);
}

async function makeSfx(key, { prompt, seconds }) {
    // Low bitrate keeps effects to a few KB each.
    // The API accepts 0.5 to 30 seconds.
    return post('/v1/sound-generation?output_format=mp3_44100_64', { text: prompt, duration_seconds: Math.min(30, Math.max(0.5, seconds)), prompt_influence: 0.6 });
}

async function makeMusic(key, { prompt, seconds }) {
    return post('/v1/music?output_format=mp3_44100_96', { prompt, music_length_ms: seconds * 1000 });
}

// Picks the account voice whose name, labels and description best match the wanted words.
let voiceList = null;
async function pickVoice(wanted) {
    if(!voiceList) {
        const response = await fetch(`${API}/v1/voices`, { headers: headers() });
        if(!response.ok) throw new Error(`ElevenLabs voices failed (${response.status})`);
        voiceList = (await response.json()).voices || [];
    }
    // Whole words only ("male" must not match "female"); "man"/"woman" mean the gender label.
    const alias = { man: 'male', woman: 'female' };
    const words = wanted.toLowerCase().split(/\s+/).map(w => alias[w] || w);
    const score = v => {
        const text = new Set([v.name, v.description, ...Object.values(v.labels || {})].join(' ').toLowerCase().split(/[^a-z]+/));
        return words.filter(w => text.has(w)).length;
    };
    // Cloned voices are personal; use only the stock ones.
    const best = voiceList.filter(v => v.category !== 'cloned').sort((a, b) => score(b) - score(a))[0];
    if(!best) throw new Error('No voices on this ElevenLabs account.');
    return best;
}

async function makeVoice(key, { text, voice }) {
    const chosen = await pickVoice(voice);
    console.log(`  ${key}: voice "${chosen.name}"`);
    return post(`/v1/text-to-speech/${chosen.voice_id}?output_format=mp3_44100_64`, {
        text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.6 }
    });
}

const GROUPS = { sfx: [SFX, makeSfx], music: [MUSIC, makeMusic], voice: [VOICE, makeVoice] };

async function main() {
    if(!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is not set. Add it in the environment settings (never paste it into code or chat).');
    const args = process.argv.slice(2);
    const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
    const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
    const force = args.includes('--force');
    for(const [dir, [list, make]] of Object.entries(GROUPS)) {
        if(which !== 'all' && which !== dir) continue;
        console.log(`${dir}:`);
        for(const [key, spec] of Object.entries(list)) {
            if(only && !only.has(key)) continue;
            if(!force && await exists(`public/audio/${dir}/${key}.mp3`)) continue;
            await save(dir, key, await make(key, spec));
        }
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
