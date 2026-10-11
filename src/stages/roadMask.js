// Road maths for the big stages (docs/design/stage-world-framework.md): a road is a smooth line through control points, and the
// walkable ground is a coarse grid stamped along it. The grid answers "can anyone stand here?" in one lookup, so the cliffs on
// either side are real walls for the marshal, the outlaws' men and the bullets. Pure functions: no THREE, easy to test.

// A Catmull-Rom curve through the control points, `perSegment` points between each pair.
export function smoothPolyline(points, perSegment = 10) {
    if(points.length < 3) return points.map(([x, z]) => ({ x, z }));
    const out = [];
    const at = i => points[Math.max(0, Math.min(points.length - 1, i))];
    for(let i = 0; i < points.length - 1; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        for(let s = 0; s < perSegment; s++) {
            const t = s / perSegment, t2 = t * t, t3 = t2 * t;
            const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
            out.push({ x: f(0), z: f(1) });
        }
    }
    const last = points[points.length - 1];
    out.push({ x: last[0], z: last[1] });
    return out;
}

// Evenly spaced samples along a line, each with its heading and the distance travelled so far.
export function resample(line, step = 2) {
    const samples = [];
    let travelled = 0;
    let carry = 0;
    for(let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if(len === 0) continue;
        const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
        let along = carry;
        while(along < len) {
            samples.push({ x: a.x + tx * along, z: a.z + tz * along, tx, tz, d: travelled + along });
            along += step;
        }
        carry = along - len;
        travelled += len;
    }
    const end = line[line.length - 1];
    const prev = samples[samples.length - 1];
    samples.push({ x: end.x, z: end.z, tx: prev?.tx ?? 1, tz: prev?.tz ?? 0, d: travelled });
    return { samples, length: travelled };
}

// The point `fraction` (0..1) of the way along the samples, pushed `off` to the right of the heading (negative = left).
export function pointAlong(road, fraction, off = 0) {
    const target = Math.max(0, Math.min(1, fraction)) * road.length;
    let lo = 0, hi = road.samples.length - 1;
    while(lo < hi) {
        const mid = (lo + hi) >> 1;
        if(road.samples[mid].d < target) lo = mid + 1; else hi = mid;
    }
    const s = road.samples[lo];
    return { x: s.x - s.tz * off, z: s.z + s.tx * off, tx: s.tx, tz: s.tz };
}

// A grid of walkable cells. `corridors` are { line: [{x,z}], width }; `discs` are { x, z, r } (camps, clearings, nooks).
export function createWalkMask({ corridors = [], discs = [], cell = 3, margin = 6 }) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    const grow = (x, z, r) => {
        minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
        minZ = Math.min(minZ, z - r); maxZ = Math.max(maxZ, z + r);
    };
    const stamps = [];
    for(const corridor of corridors) {
        for(const s of resample(corridor.line, cell * 0.75).samples) {
            grow(s.x, s.z, corridor.width / 2 + margin);
            stamps.push({ x: s.x, z: s.z, r: corridor.width / 2 });
        }
    }
    for(const d of discs) { grow(d.x, d.z, d.r + margin); stamps.push(d); }
    minX = Math.floor(minX / cell) * cell; minZ = Math.floor(minZ / cell) * cell;
    const cols = Math.ceil((maxX - minX) / cell) + 1;
    const rows = Math.ceil((maxZ - minZ) / cell) + 1;
    const data = new Uint8Array(cols * rows);
    for(const st of stamps) {
        const c0 = Math.max(0, Math.floor((st.x - st.r - minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((st.x + st.r - minX) / cell));
        const r0 = Math.max(0, Math.floor((st.z - st.r - minZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((st.z + st.r - minZ) / cell));
        for(let r = r0; r <= r1; r++) {
            for(let c = c0; c <= c1; c++) {
                const cx = minX + (c + 0.5) * cell, cz = minZ + (r + 0.5) * cell;
                if(Math.hypot(cx - st.x, cz - st.z) <= st.r) data[r * cols + c] = 1;
            }
        }
    }
    const cellAt = (x, z) => {
        const c = Math.floor((x - minX) / cell), r = Math.floor((z - minZ) / cell);
        return (c < 0 || r < 0 || c >= cols || r >= rows) ? 0 : data[r * cols + c];
    };
    return {
        cell, cols, rows, minX, minZ,
        isWalkable: (x, z) => cellAt(x, z) === 1,
        // Closed cells that touch open ones: where the cliffs stand. cb(x, z, nx, nz) gets the cell centre and the way out of the rock.
        forEachWallCell(cb) {
            for(let r = 0; r < rows; r++) {
                for(let c = 0; c < cols; c++) {
                    if(data[r * cols + c]) continue;
                    let nx = 0, nz = 0;
                    for(let dr = -2; dr <= 2; dr++) for(let dc = -2; dc <= 2; dc++) {
                        const rr = r + dr, cc = c + dc;
                        if(rr >= 0 && cc >= 0 && rr < rows && cc < cols && data[rr * cols + cc]) { nx += dc; nz += dr; }
                    }
                    if(nx === 0 && nz === 0) continue;
                    cb(minX + (c + 0.5) * cell, minZ + (r + 0.5) * cell, nx, nz, c, r);
                }
            }
        }
    };
}
