// Generates 256x256 WebP portraits with transparent backgrounds for all regular enemies
// from the high-res concept art in art/characters/ into public/portraits/enemy-<id>.webp.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ENEMIES = [
    { id: 'bandit', file: 'art/characters/bandit.jpg', square: false },
    { id: 'gunslinger', file: 'art/characters/gunslinger.jpg', square: false },
    { id: 'rattler', file: 'art/characters/rattler.jpg', square: true },
    { id: 'rifleman', file: 'art/characters/rifleman.jpg', square: false },
    { id: 'dynamiter', file: 'art/characters/dynamiter.jpg', square: false },
    { id: 'brute', file: 'art/characters/brute.jpg', square: false },
    { id: 'rider', file: 'art/characters/rider.jpg', square: true },
    { id: 'duelist', file: 'art/characters/duelist.jpg', square: false },
    { id: 'ghost', file: 'art/characters/ghost.jpg', square: false },
    { id: 'knifer', file: 'art/characters/knifer.jpg', square: false },
    { id: 'trooper', file: 'art/characters/trooper.jpg', square: false }
];

async function processEnemy({ id, file, square }) {
    const input = sharp(file);
    const meta = await input.metadata();

    let cropped;
    if (square) {
        cropped = input.resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } });
    } else {
        const size = meta.width;
        cropped = input
            .extract({ left: 0, top: 0, width: size, height: size })
            .resize(256, 256);
    }

    const { data, info } = await cropped.raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;

    // Corner flood-fill to find connected background
    const isBg = new Uint8Array(w * h);
    const visited = new Uint8Array(w * h);
    const queue = [];

    function checkPixel(x, y) {
        const idx = y * w + x;
        if (visited[idx]) return false;
        visited[idx] = 1;
        const r = data[idx * 3];
        const g = data[idx * 3 + 1];
        const b = data[idx * 3 + 2];
        // Near-white studio backdrop
        if (r > 235 && g > 230 && b > 225) {
            isBg[idx] = 1;
            return true;
        }
        return false;
    }

    // Seed borders
    for (let x = 0; x < w; x++) {
        if (checkPixel(x, 0)) queue.push(x, 0);
        if (checkPixel(x, h - 1)) queue.push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        if (checkPixel(0, y)) queue.push(0, y);
        if (checkPixel(w - 1, y)) queue.push(w - 1, y);
    }

    // BFS
    let head = 0;
    while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
        ];
        for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                if (checkPixel(nx, ny)) {
                    queue.push(nx, ny);
                }
            }
        }
    }

    // Build RGBA output with soft edge feathering
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            rgba[idx * 4] = data[idx * 3];
            rgba[idx * 4 + 1] = data[idx * 3 + 1];
            rgba[idx * 4 + 2] = data[idx * 3 + 2];

            if (isBg[idx]) {
                rgba[idx * 4 + 3] = 0;
            } else {
                // If adjacent to background, apply subtle anti-aliasing
                let bgCount = 0;
                if (x > 0 && isBg[idx - 1]) bgCount++;
                if (x < w - 1 && isBg[idx + 1]) bgCount++;
                if (y > 0 && isBg[idx - w]) bgCount++;
                if (y < h - 1 && isBg[idx + w]) bgCount++;

                if (bgCount > 0) {
                    const r = data[idx * 3];
                    const g = data[idx * 3 + 1];
                    const b = data[idx * 3 + 2];
                    if (r > 220 && g > 215 && b > 210) {
                        rgba[idx * 4 + 3] = Math.max(80, 255 - bgCount * 45);
                    } else {
                        rgba[idx * 4 + 3] = 255;
                    }
                } else {
                    rgba[idx * 4 + 3] = 255;
                }
            }
        }
    }

    const outPath = `public/portraits/enemy-${id}.webp`;
    await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
        .webp({ quality: 90 })
        .toFile(outPath);
    console.log(`Generated ${outPath}`);
    return `enemy-${id}`;
}

async function main() {
    for (const enemy of ENEMIES) {
        await processEnemy(enemy);
    }
    console.log('All enemy portraits generated successfully.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
