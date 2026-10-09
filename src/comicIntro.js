// Story Comic Introduction System.
// Displays a stylised multi-panel prologue comic strip when starting an outlaw run,
// illustrating their backstory and the narrative stakes before entering the open world.

export const COMIC_STORIES = {
    'dusty-pete': {
        title: 'THE TIN CUP SHAKEDOWN',
        subtitle: 'Dusty Pete &middot; Copper Bit Gulch',
        outlawName: 'Dusty Pete',
        bounty: 150,
        panels: [
            {
                number: 1,
                title: 'The Tin Cup Saloon',
                caption: 'Copper Bit &middot; Autumn 1887',
                text: 'Pete ran the Tin Cup, the rowdiest bar in Copper Bit, playing a busted piano no man could tune. When miners ran up debts, Pete took their deed papers instead.',
                artClass: 'comic-art-saloon',
                icon: '&#9835;'
            },
            {
                number: 2,
                title: 'The Company Contract',
                caption: 'Meridian Land & Rail',
                text: 'A land agent paid Pete fifty dollars a claim for rough work: terrorising honest prospectors and snatching their mining rights.',
                artClass: 'comic-art-receipt',
                icon: '&#9993;'
            },
            {
                number: 3,
                title: 'Flight to the Badlands',
                caption: 'Copper Bit Gulch',
                text: 'When the law rode into town, Pete grabbed his revolvers and retreated into the red rocks and abandoned mine tunnels of the canyon.',
                artClass: 'comic-art-canyon',
                icon: '&#9968;'
            },
            {
                number: 4,
                title: 'The Hunt Begins',
                caption: 'WANTED: DEAD OR ALIVE',
                text: 'Follow his trail through the canyon. Search the camps, uncover the stolen receipts, and bring Pete to justice.',
                artClass: 'comic-art-marshal',
                icon: '&#9733;'
            }
        ]
    }
};

const COMIC_STORAGE_KEY = 'redWestComicSeen.v1';

// Check if player has already viewed the prologue comic for this outlaw.
export function hasSeenComic(outlawId, storage = globalThis.localStorage) {
    if(!storage) return false;
    try {
        const seen = JSON.parse(storage.getItem(COMIC_STORAGE_KEY) || '[]');
        return Array.isArray(seen) && seen.includes(outlawId);
    } catch {
        return false;
    }
}

// Mark an outlaw's comic as seen.
export function markComicSeen(outlawId, storage = globalThis.localStorage) {
    if(!storage) return false;
    try {
        const seen = JSON.parse(storage.getItem(COMIC_STORAGE_KEY) || '[]');
        const updated = Array.isArray(seen) ? [...new Set([...seen, outlawId])] : [outlawId];
        storage.setItem(COMIC_STORAGE_KEY, JSON.stringify(updated));
        return true;
    } catch {
        return false;
    }
}

// Generate the HTML for the comic strip overlay modal.
export function renderComicIntroHtml(outlawId) {
    const comic = COMIC_STORIES[outlawId];
    if(!comic) return '';

    const panelsHtml = comic.panels.map(p => `
        <div class="comic-panel ${p.artClass}">
            <div class="comic-panel-header">
                <span class="comic-panel-num">PANEL ${p.number}</span>
                <span class="comic-panel-caption">${p.caption}</span>
            </div>
            <div class="comic-panel-graphic" aria-hidden="true">
                <span class="comic-glyph">${p.icon}</span>
            </div>
            <div class="comic-panel-body">
                <h4>${p.title}</h4>
                <p>${p.text}</p>
            </div>
        </div>
    `).join('');

    return `
    <div id="comic-intro-modal" class="comic-overlay">
        <div class="comic-card">
            <header class="comic-header">
                <span class="comic-tag">PROLOGUE COMIC</span>
                <h2 class="comic-title">${comic.title}</h2>
                <p class="comic-subtitle">${comic.subtitle}</p>
            </header>
            <div class="comic-strip">
                ${panelsHtml}
            </div>
            <footer class="comic-footer">
                <button type="button" id="comic-start-btn" class="comic-btn">BEGIN PURSUIT &rarr;</button>
            </footer>
        </div>
    </div>`;
}
