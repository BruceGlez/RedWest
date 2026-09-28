// Front-view picture of a character from its prompt (tools/character-prompts.mjs) through the
// OpenAI Images API, saved to art/characters/<name>.png for approval before tools/meshy.mjs.
//
//   export OPENAI_API_KEY=...   (set it in the environment's settings; never commit it)
//   node tools/character-picture.mjs <name> [--model gpt-image-1] [--extra "more instructions"]
import { mkdir, writeFile } from 'node:fs/promises';
import { promptFor } from './character-prompts.mjs';

function parseArgs([name, ...rest]) {
    const options = { name, model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', extra: '' };
    for(let i = 0; i < rest.length; i += 2) {
        const key = rest[i].replace(/^--/, '');
        if(key === 'model') options.model = rest[i + 1];
        else if(key === 'extra') options.extra = rest[i + 1];
        else throw new Error(`Unknown option --${key}`);
    }
    if(!name) throw new Error('Usage: node tools/character-picture.mjs <name> [--model gpt-image-1] [--extra "..."]');
    return options;
}

async function main() {
    if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set. Add it in the environment settings (never paste it into code or chat).');
    const options = parseArgs(process.argv.slice(2));
    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        // Portrait: a standing T-pose character fills a tall frame best.
        body: JSON.stringify({ model: options.model, prompt: promptFor(options.name, options.extra), size: '1024x1536', quality: 'high', n: 1 })
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw new Error(`OpenAI image request failed (${response.status}): ${data.error?.message || JSON.stringify(data)}`);
    const b64 = data.data?.[0]?.b64_json;
    if(!b64) throw new Error(`No image in the response: ${JSON.stringify(data).slice(0, 300)}`);
    await mkdir('art/characters', { recursive: true });
    const file = `art/characters/${options.name}.png`;
    await writeFile(file, Buffer.from(b64, 'base64'));
    console.log(`Wrote ${file} (${options.model})`);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
