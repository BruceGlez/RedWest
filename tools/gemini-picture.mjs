// Picture of an animal or character from its prompt (tools/character-prompts.mjs) through the
// Gemini API, saved to art/characters/<name>.jpg.
//
//   export Gemini=...   (or GEMINI_API_KEY; set it in the environment's settings, never commit it)
//   node tools/gemini-picture.mjs <name> [--model gemini-3.1-flash-image] [--extra "more instructions"]
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { promptFor } from './character-prompts.mjs';

const KEY = process.env.GEMINI_API_KEY || process.env.Gemini;

function parseArgs([name, ...rest]) {
    const options = { name, model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image', extra: '' };
    for(let i = 0; i < rest.length; i += 2) {
        const key = rest[i].replace(/^--/, '');
        if(key === 'model') options.model = rest[i + 1];
        else if(key === 'extra') options.extra = rest[i + 1];
        else throw new Error(`Unknown option --${key}`);
    }
    if(!name) throw new Error('Usage: node tools/gemini-picture.mjs <name> [--model ...] [--extra "..."]');
    return options;
}

async function main() {
    if(!KEY) throw new Error('GEMINI_API_KEY (or Gemini) is not set. Add it in the environment settings (never paste it into code or chat).');
    const options = parseArgs(process.argv.slice(2));
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptFor(options.name, options.extra) }] }],
            generationConfig: { responseModalities: ['IMAGE'] }
        })
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw new Error(`Gemini image request failed (${response.status}): ${data.error?.message || JSON.stringify(data).slice(0, 300)}`);
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if(!part) throw new Error(`No image in the response: ${JSON.stringify(data).slice(0, 300)}`);
    await mkdir('art/characters', { recursive: true });
    const file = `art/characters/${options.name}.jpg`;
    await sharp(Buffer.from(part.inlineData.data, 'base64')).jpeg({ quality: 92 }).toFile(file);
    console.log(`Wrote ${file} (${options.model})`);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
