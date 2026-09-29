// One outlaw name per account. Short, uppercase, letters/digits/spaces, checked against a blocklist
// on both the game and the server. Players can also report names (server/app.js), which hides a name
// once several accounts report it. Add a moderation service before a wide launch.
// Checked after common digit swaps (0→O, 1→I, 3→E, 4→A, 5→S). Words that are never part of an innocent
// name are matched anywhere, even across spaces; short ones that are ("SUSSEX", "SPICY", "COCKATOO")
// only as a whole word (optionally plural).
const BLOCKED_ANYWHERE = [
    'FUCK', 'SHIT', 'CUNT', 'NIGG', 'WHORE', 'BITCH', 'ASSHOLE', 'RAPIST', 'PENIS', 'VAGINA', 'PUSSY', 'BASTARD',
    'WANK', 'JIZZ', 'PORN', 'RETARD', 'TRANNY', 'MOLEST', 'KILLYOURSELF', 'NAZI', 'HITLER', 'KKK', 'I488',
    'MIERDA', 'CHINGA', 'PENDEJ', 'MARICON', 'CARALHO', 'BUCETA', 'PUTAIN', 'SALOPE', 'CONNARD', 'SCHEISSE',
    'HURENSOHN', 'CAZZO', 'VAFFANCULO', 'STRONZO',
    'ADMIN', 'MODERATOR', 'REDWESTTEAM' // impersonating staff
];
const BLOCKED_WORDS = [
    'FUK', 'FCK', 'FAG', 'RAPE', 'DICK', 'COCK', 'SLUT', 'CUM', 'SEX', 'NUDE', 'TWAT', 'PEDO', 'SPIC', 'CHINK',
    'KIKE', 'DYKE', 'KYS', 'HEIL', 'ISIS', 'PUTA', 'PUTO', 'CULO', 'MERDA', 'COJON', 'ENCULE', 'FOTZE',
    'OFFICIAL', 'SUPPORT'
];

export const NAME_MIN = 3;
export const NAME_MAX = 14;

export function normalizeName(raw) {
    return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function isBlocked(name) {
    const swapped = name.replace(/0/g, 'O').replace(/1/g, 'I').replace(/3/g, 'E').replace(/4/g, 'A').replace(/5/g, 'S');
    const squashed = swapped.replace(/ /g, '');
    if(BLOCKED_ANYWHERE.some(word => squashed.includes(word))) return true;
    return swapped.split(' ').some(word => BLOCKED_WORDS.includes(word) || BLOCKED_WORDS.includes(word.replace(/S$/, '')));
}

export function validateName(raw) {
    const name = normalizeName(raw);
    if(name.length < NAME_MIN) return { ok: false, name, error: `At least ${NAME_MIN} letters or numbers.` };
    if(name.length > NAME_MAX) return { ok: false, name, error: `At most ${NAME_MAX} characters.` };
    if(isBlocked(name)) return { ok: false, name, error: 'Pick a different name.' };
    return { ok: true, name };
}

// Names for players under 13, who never type one (see src/privacy.js): a word and four digits.
const GENERATED_WORDS = ['RIDER', 'RANGER', 'DRIFTER', 'WRANGLER', 'DEPUTY', 'SCOUT', 'TRACKER', 'COWPOKE'];
const GENERATED = new RegExp(`^(${GENERATED_WORDS.join('|')}) [0-9]{4}$`);

export function generatedName(random = Math.random) {
    const word = GENERATED_WORDS[Math.floor(random() * GENERATED_WORDS.length)];
    return `${word} ${String(Math.floor(random() * 10000)).padStart(4, '0')}`;
}

export function isGeneratedName(name) {
    return GENERATED.test(String(name ?? ''));
}
