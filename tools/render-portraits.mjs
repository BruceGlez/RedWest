// Renders the pictures of every 3D character once, into small image files the game ships with:
//   public/portraits/<outlaw-id>.webp   WANTED poster (head and shoulders), outlaws only
//   public/portraits/<character-id>.webp  character card in the shop
// and writes src/portraitFiles.js, the list the game checks. With these the menus never wait for a
// 1 MB model download to show a face (playtest: "the pictures don't always load").
// Run after adding or changing a model in public/models/:
//
//   npm i --no-save sharp
//   CHROME_PATH=/path/to/chrome node tools/render-portraits.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp';
import { findChrome } from '../tests/chrome-path.mjs';
import { answeredPrivacy } from '../tests/privacy-seed.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
try {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    await context.addInitScript(answeredPrivacy);
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit' });
    await page.locator('canvas').waitFor({ timeout: 120000 });
    const pictures = await page.evaluate(async () => {
        const { renderCharacterPortrait, renderPlayerPreview } = await import('/src/portraits.js');
        const { loadCharacterModel, createCharacterInstance } = await import('/src/characterModels.js');
        const { CHARACTERS } = await import('/src/cosmetics.js');
        const { OUTLAWS } = await import('/src/outlaws.js');
        const renderer = window.__redWestRenderer;
        const out = {};
        for(const item of CHARACTERS) {
            if(!item.model) continue;
            const instance = createCharacterInstance(await loadCharacterModel(item.model), 6);
            instance.mixer.update(0.4); // a moment into the idle pose, as in the game
            const outlaw = item.unlock ? OUTLAWS[item.unlock.outlaw] : null;
            if(outlaw) out[outlaw.id] = renderCharacterPortrait(renderer, instance.object);
            instance.object.rotation.y = 0.5;
            out[item.id] = renderPlayerPreview(renderer, null, instance.object);
        }
        return out;
    });
    await mkdir('public/portraits', { recursive: true });
    const names = [];
    for(const [name, dataUrl] of Object.entries(pictures)) {
        if(!dataUrl?.startsWith('data:image')) throw new Error(`No picture for ${name}`);
        const png = Buffer.from(dataUrl.split(',')[1], 'base64');
        await writeFile(`public/portraits/${name}.webp`, await sharp(png).webp({ quality: 85 }).toBuffer());
        names.push(name);
    }
    names.sort();
    await writeFile('src/portraitFiles.js', `// Written by tools/render-portraits.mjs: pictures in public/portraits/ (<name>.webp).\nexport const PORTRAIT_FILES = new Set(${JSON.stringify(names, null, 4).replace(/"/g, "'")});\n`);
    console.log(`Wrote ${names.length} pictures to public/portraits/ and src/portraitFiles.js`);
} finally {
    await browser.close();
    await server.close();
}
