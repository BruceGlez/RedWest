// Switching Section 1 on: fetch the two small data files the art export writes, build the area, and install it as Pete's first area
// (src/stages/pete.js). The big chunk files load later, when the scene is mounted.
//
// Section 1 is Pete's first area. The switch stays as a way back: ?section1=0 (or localStorage "rw-section1" = "0") plays the original Area 1
// exactly as before, ?section1=1 turns it on again.

import { createSection1Area } from './peteSection1.js';
import { installSection1, uninstallSection1, section1Installed } from './pete.js';
import { createSection1Parts } from '../placePeteSection1.js';
import { assetUrl } from '../demo.js';

export const SECTION1_SWITCH_KEY = 'rw-section1';
const DATA = 'models/pete-area1/';

// ?section1=1 or 0 wins, else the stored choice, else on.
export function section1Enabled(search = globalThis.location?.search ?? '', storage = globalThis.localStorage) {
    const param = new URLSearchParams(search).get('section1');
    if(param === '1' || param === '0') {
        try { storage?.setItem(SECTION1_SWITCH_KEY, param); } catch { /* private mode */ }
        return param === '1';
    }
    try { return storage?.getItem(SECTION1_SWITCH_KEY) !== '0'; } catch { return true; }
}

export async function loadSection1Area(fetchJson = path => fetch(assetUrl(path)).then(r => { if(!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); })) {
    const [collision, markerFile] = await Promise.all([fetchJson(`${DATA}pete_section1_collision.json`), fetchJson(`${DATA}pete_section1_markers.json`)]);
    return createSection1Area({ collision, markers: markerFile.markers, sceneFactory: opts => createSection1Parts(opts) });
}

let loading = null;
// Called once at start-up. Never throws: if the data cannot load, the original area stays.
export function preloadSection1(options = {}) {
    if(loading) return loading;
    const enabled = options.enabled ?? (typeof window !== 'undefined' && section1Enabled());   // node tests never fetch it on their own
    if(!enabled) { if(section1Installed()) uninstallSection1(); return (loading = Promise.resolve(false)); }
    loading = loadSection1Area(options.fetchJson).then(area => { installSection1(area); return true; }).catch(error => {
        console.warn('Section 1 could not load; the original Area 1 stays.', error);
        return false;
    });
    return loading;
}
export function resetSection1Preload() { loading = null; }
