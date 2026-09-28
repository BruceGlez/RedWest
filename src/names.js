// One outlaw name per account. Short, uppercase, letters/digits/spaces, with a basic blocklist.
// The blocklist is intentionally small; add a proper moderation service before a wide launch.
const BLOCKED = ['FUCK', 'SHIT', 'CUNT', 'NIGG', 'FAG', 'RAPE', 'NAZI', 'HITLER', 'PENIS', 'VAGINA', 'SLUT', 'WHORE', 'BITCH', 'ADMIN', 'MODERATOR'];

export const NAME_MIN = 3;
export const NAME_MAX = 14;

export function normalizeName(raw) {
    return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function validateName(raw) {
    const name = normalizeName(raw);
    if(name.length < NAME_MIN) return { ok: false, name, error: `At least ${NAME_MIN} letters or numbers.` };
    if(name.length > NAME_MAX) return { ok: false, name, error: `At most ${NAME_MAX} characters.` };
    const squashed = name.replace(/ /g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/3/g, 'E').replace(/4/g, 'A').replace(/5/g, 'S');
    if(BLOCKED.some(word => squashed.includes(word))) return { ok: false, name, error: 'Pick a different name.' };
    return { ok: true, name };
}
