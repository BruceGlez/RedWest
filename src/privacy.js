// First-launch privacy answers: the player's age band (from a neutral birth-year question) and whether
// they opt in to sharing gameplay statistics. Stored on the device; the server gets the age band only.
//
// Under 13: no statistics, no typed outlaw name (a generated one is used), and no real-money packs.
// Only the age band is kept, never the birth year.

const PRIVACY_KEY = 'redWestPrivacy.v1';
export const AGE_BANDS = ['under13', 'teen', 'adult'];

// A birth year alone cannot tell whether this year's birthday has passed, so the younger age is used:
// someone who turns 13 this year counts as under 13 until next year.
export function ageBandFromYear(year, now = new Date()) {
    const born = Number(year);
    const thisYear = now.getFullYear();
    if(!Number.isInteger(born) || born < thisYear - 120 || born > thisYear) return null;
    const age = thisYear - born - 1;
    if(age < 13) return 'under13';
    if(age < 18) return 'teen';
    return 'adult';
}

// Years for the question, newest first, with no year preselected (a neutral age screen).
export function birthYearOptions(now = new Date()) {
    const thisYear = now.getFullYear();
    return Array.from({ length: 101 }, (_, i) => thisYear - i);
}

function normalize(raw) {
    if(!raw || !AGE_BANDS.includes(raw.ageBand)) return null;
    return {
        ageBand: raw.ageBand,
        // Children never share statistics, whatever was stored.
        statsConsent: raw.ageBand !== 'under13' && raw.statsConsent === true,
        answeredAt: typeof raw.answeredAt === 'string' ? raw.answeredAt : ''
    };
}

export function loadPrivacy() {
    try {
        return normalize(JSON.parse(localStorage.getItem(PRIVACY_KEY)));
    } catch {
        return null;
    }
}

export function savePrivacy(answers) {
    const privacy = normalize({ ...answers, answeredAt: answers.answeredAt || new Date().toISOString() });
    if(!privacy) return null;
    try {
        localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacy));
    } catch {
        // Storage blocked: the answers apply for this session only.
    }
    return privacy;
}

export const isChild = privacy => privacy?.ageBand === 'under13';
export const canShareStats = privacy => !!privacy && !isChild(privacy) && privacy.statsConsent;
