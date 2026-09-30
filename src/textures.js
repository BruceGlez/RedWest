import * as THREE from 'three';

// Procedural textures, drawn once at startup so the game needs no image files.

function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Ground for one stage (style: the `terrain` of an atmosphere in atmosphere.js). The default is the sun-baked desert:
// warm sand with darker patches, pebbles, dry cracks and scrub. Other stages change the colours and counts, and
// some add a pattern of their own: wheel ruts, furrows, deck planks or dirty snow patches. 1024 px, drawn once
// per stage (the previous stage's texture is freed), so the ground costs one texture at a time.
export function createGroundTexture(style, size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(1851);

    ctx.fillStyle = style.base;
    ctx.fillRect(0, 0, size, size);

    // Soft light and dark patches (drawn with wrap-around so the texture tiles seamlessly).
    const blob = (x, y, r, color) => {
        for(const dx of [-size, 0, size]) {
            for(const dy of [-size, 0, size]) {
                const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
                g.addColorStop(0, color);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
            }
        }
    };
    for(let i = 0; i < 26; i++) blob(rand() * size, rand() * size, 60 + rand() * 160, style.blotchDark);
    for(let i = 0; i < 18; i++) blob(rand() * size, rand() * size, 50 + rand() * 120, style.blotchLight);
    for(let i = 0; i < 8; i++) blob(rand() * size, rand() * size, 40 + rand() * 70, style.blotchDark);

    // A pattern of the stage's own. Every one tiles: bands run the full width, planks and furrows divide the size evenly.
    if(style.extra === 'ruts') {
        for(const y of [0.28, 0.36, 0.72, 0.8]) { ctx.fillStyle = style.extraColor; ctx.fillRect(0, size * y, size, size * 0.035); }
    } else if(style.extra === 'furrows') {
        for(let x = 0; x < size; x += 64) { ctx.fillStyle = style.extraColor; ctx.fillRect(x, 0, 18, size); }
    } else if(style.extra === 'planks') {
        for(let row = 0; row < size / 64; row++) {
            ctx.fillStyle = row % 2 ? 'rgba(255, 220, 170, 0.1)' : 'rgba(40, 20, 10, 0.1)';
            ctx.fillRect(0, row * 64, size, 64);
            ctx.fillStyle = style.extraColor;
            ctx.fillRect(0, row * 64, size, 3);
            const shift = ((row * 5) % 8) * 128;
            for(let x = shift; x < size + shift; x += 512) ctx.fillRect(x % size, row * 64, 3, 64);
        }
    } else if(style.extra === 'patches') {
        for(let i = 0; i < 14; i++) blob(rand() * size, rand() * size, 40 + rand() * 80, style.extraColor);
    }

    // Fine grain.
    for(let i = 0; i < 9000; i++) {
        ctx.fillStyle = rand() < 0.5 ? style.grain[0] : style.grain[1];
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }

    // Cracks.
    ctx.strokeStyle = style.crack;
    ctx.lineCap = 'round';
    for(let i = 0; i < style.cracks; i++) {
        let x = rand() * size;
        let y = rand() * size;
        let angle = rand() * Math.PI * 2;
        ctx.lineWidth = 1 + rand() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for(let s = 0; s < 6 + rand() * 6; s++) {
            angle += (rand() - 0.5) * 1.2;
            x += Math.cos(angle) * (8 + rand() * 14);
            y += Math.sin(angle) * (8 + rand() * 14);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Pebbles with a highlight.
    for(let i = 0; i < style.pebbles; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 1.5 + rand() * 3.5;
        ctx.fillStyle = style.pebble;
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = style.pebbleHi;
        ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Dry scrub or grass tufts.
    for(let i = 0; i < (style.scrub ? style.scrubs : 0); i++) {
        const x = rand() * size;
        const y = rand() * size;
        ctx.strokeStyle = rand() < 0.5 ? style.scrub[0] : style.scrub[1];
        ctx.lineWidth = 1.5;
        for(let b = 0; b < 7; b++) {
            const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
            const len = 5 + rand() * 9;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
}

// Warm sunset sky for anything above the horizon (mostly seen on the lobby camera).
// stops: four colours (hex numbers) from the top of the sky to the horizon; the default is the warm sunset.
export function createSkyTexture(stops = [0x6fb3e0, 0xf4c98e, 0xffb070, 0xf7d7a8]) {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    [0, 0.45, 0.75, 1].forEach((at, i) => g.addColorStop(at, `#${stops[i].toString(16).padStart(6, '0')}`));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
