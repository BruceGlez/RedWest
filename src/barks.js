import { STAR_DEFEATED, STAR_HOT_BOUNTY } from './progress.js';
import { OUTLAWS } from './outlaws.js';

// Town barks (STORY_BIBLE.md section 6): one line from the person who runs each building, chosen from how far the
// marshal has got. Deterministic (the same progress always gets the same line), serious voice, and never blocking:
// the line is a quiet extra on the building's card.
export const BARK_MAX = 130;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function counts(progress) {
    const beaten = progress.stars.filter(mask => (mask & STAR_DEFEATED) !== 0).length;
    const pages = progress.stars.filter(mask => (mask & STAR_HOT_BOUNTY) !== 0).length;
    return { beaten, pages, all: OUTLAWS.length };
}
const beatenIndex = (progress, id) => {
    const i = OUTLAWS.findIndex(o => o.id === id);
    return i >= 0 && (progress.stars[i] & STAR_DEFEATED) !== 0;
};

// Returns { speaker, text } for a building, or null if nobody there has anything to say.
export function barkFor(buildingId, progress) {
    const { beaten, pages, all } = counts(progress);
    switch(buildingId) {
        case 'sheriff': {
            const speaker = 'Deputy June Holloway';
            if(pages >= all) return { speaker, text: 'Ten pages. Take them to the court, Marshal. I will ride with you.' };
            if(pages >= 5) return { speaker, text: `${plural(pages, 'page')} in the Case File. Whoever keeps these books is careful, and rich. Be careful yourself.` };
            if(pages >= 1) return { speaker, text: `${plural(pages, 'page')} on the case board. They all carry the same seal. I checked.` };
            if(beaten >= 1) return { speaker, text: 'Every name you bring in goes on my board. I have started to ask who paid them.' };
            return { speaker, text: 'My case board is empty, Marshal. It will not stay that way.' };
        }
        case 'gunsmith': {
            const speaker = 'Ezra Stone';
            if(beatenIndex(progress, 'iron-jack')) return { speaker, text: 'Jack\'s armour was riveted on for a test. I found the bolt. Some men build to keep things safe, some to keep them in.' };
            if(beaten >= 5) return { speaker, text: 'Your gun has seen some road. Bring it by. Iron does not complain, but it remembers.' };
            return { speaker, text: 'Look after your gun and it will look after you, Marshal.' };
        }
        case 'jail': {
            const speaker = 'The jail';
            if(beaten >= all) return { speaker, text: 'Every cell is full. It is the friendliest jail in the territory, and nobody wants to leave.' };
            if(beaten >= 1) return { speaker, text: `${plural(beaten, 'guest')} so far. They eat well, they work, and they talk about the same Company.` };
            return { speaker, text: 'Empty cells. The lamp is lit for whoever comes first.' };
        }
        case 'bank': {
            const speaker = 'Mr. Ollie Pruitt';
            if(beaten >= 3) return { speaker, text: 'A steady account, Marshal. I have not been asked to look the other way. Not yet.' };
            return { speaker, text: 'Your money is safe here. I do not take the Company\'s, and I do not lend to it.' };
        }
        case 'saloon': {
            const speaker = 'The barkeep';
            if(beatenIndex(progress, 'dusty-pete')) return { speaker, text: 'Pete plays the piano now, and badly. Nobody minds. Nobody minds anything Pete does these days.' };
            return { speaker, text: 'Quiet tonight. The man who ran the Tin Cup is still out there somewhere.' };
        }
        case 'tailor':
            return { speaker: 'The tailor', text: 'They say the Drifter has worn every coat in the territory, and never grown older in any of them.' };
        case 'depot':
            return { speaker: 'The station master', text: 'The train was late again. Somebody at the Company office wanted it that way.' };
        default:
            return null;
    }
}
