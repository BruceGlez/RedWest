// Packs the demo build (dist-demo/, from `vite build --mode demo`) into one self-contained HTML file for ad
// networks: dist-demo/red-west-playable.html. Scripts and styles are inlined, and the few files the demo
// needs (two characters, sound effects, one music track, the Marshal's opening line) are embedded as data
// URIs that src/demo.js's assetUrl() finds. Nothing is fetched from the network.
//
//   npm run build:demo
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { SFX } from '../src/audioManifest.js';

const OUT = 'dist-demo/red-west-playable.html';
const LIMIT = 5 * 1024 * 1024; // the usual playable-ad size limit; check each network's current spec
const EMBED = [
    'models/marshal.glb',
    'models/dusty-pete.glb',
    'audio/music/fight.mp3',
    'audio/voice/marshal-start.mp3',
    'audio/voice/dusty-pete.mp3',
    ...Object.keys(SFX).map(key => `audio/sfx/${key}.mp3`)
];
const TYPES = { glb: 'model/gltf-binary', mp3: 'audio/mpeg' };

const assets = await readdir('dist-demo/assets');
const scripts = assets.filter(name => name.endsWith('.js'));
if(scripts.length !== 1) throw new Error(`Expected one script bundle in dist-demo/assets, found ${scripts.length}.`);
const styleName = assets.find(name => name.endsWith('.css'));
const styleText = await readFile(`dist-demo/assets/${styleName}`, 'utf8');
// A literal "</script" inside the code would end the inline script early.
const scriptText = (await readFile(`dist-demo/assets/${scripts[0]}`, 'utf8')).replace(/<\/script/gi, '<\\/script');

const embedded = {};
for(const path of EMBED) {
    const data = await readFile(`public/${path}`);
    embedded[path] = `data:${TYPES[path.split('.').pop()]};base64,${data.toString('base64')}`;
}

const html = (await readFile('dist-demo/index.html', 'utf8'))
    .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '') // Three.js is bundled
    .replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/g, '')
    .replace(/<title>[^<]*<\/title>/, '<title>Red West</title>')
    .replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/, () => `<style>${styleText}</style>`)
    .replace(/<script type="module"[^>]*src="\.\/assets\/[^"]+\.js"[^>]*><\/script>/,
        () => `<script>window.__RW_ASSETS = ${JSON.stringify(embedded)};</script>\n<script type="module">${scriptText}</script>`);

if(/src="\.\/assets\/|href="\.\/assets\//.test(html)) throw new Error('Some assets were not inlined.');
await writeFile(OUT, html);
const size = Buffer.byteLength(html);
console.log(`Wrote ${OUT}: ${(size / 1024 / 1024).toFixed(2)} MB${size > LIMIT ? ' (OVER the 5 MB playable-ad limit)' : ''}`);
if(size > LIMIT) process.exit(1);
