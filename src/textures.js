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

// Sun-baked desert ground: warm sand with darker patches, pebbles, dry cracks and scrub.
export function createDesertGroundTexture(size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(1851);

    ctx.fillStyle = '#e3b877';
    ctx.fillRect(0, 0, size, size);

    // Soft light and dark sand patches (drawn with wrap-around so the texture tiles seamlessly).
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
    for(let i = 0; i < 26; i++) blob(rand() * size, rand() * size, 60 + rand() * 160, 'rgba(200, 140, 80, 0.2)');
    for(let i = 0; i < 18; i++) blob(rand() * size, rand() * size, 50 + rand() * 120, 'rgba(250, 215, 150, 0.4)');
    for(let i = 0; i < 8; i++) blob(rand() * size, rand() * size, 40 + rand() * 70, 'rgba(180, 120, 65, 0.15)');

    // Fine grain.
    for(let i = 0; i < 9000; i++) {
        const shade = rand() < 0.5 ? 'rgba(120, 80, 40, 0.18)' : 'rgba(255, 235, 190, 0.22)';
        ctx.fillStyle = shade;
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }

    // Dry cracks.
    ctx.strokeStyle = 'rgba(120, 75, 35, 0.35)';
    ctx.lineCap = 'round';
    for(let i = 0; i < 16; i++) {
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
    for(let i = 0; i < 260; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 1.5 + rand() * 3.5;
        ctx.fillStyle = 'rgba(110, 80, 55, 0.7)';
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 240, 210, 0.5)';
        ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Dry scrub tufts.
    for(let i = 0; i < 70; i++) {
        const x = rand() * size;
        const y = rand() * size;
        ctx.strokeStyle = rand() < 0.5 ? 'rgba(128, 120, 50, 0.75)' : 'rgba(150, 110, 50, 0.75)';
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
