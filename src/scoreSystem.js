const STORAGE_KEY = 'redWestScores';
const PLAYER_NAME_KEY = 'redWestPlayerName';
const MAX_SCORES = 5;

export function loadHighScores() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if(!Array.isArray(parsed)) return [];
        return parsed.filter(s => s && typeof s.name === 'string' && typeof s.score === 'number');
    } catch {
        return [];
    }
}

export function saveHighScore(name, score) {
    let scores = loadHighScores();
    const normalized = (name || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
    const existing = scores.find(s => s.name === normalized);
    if(existing) existing.score = Math.max(existing.score, score);
    else scores.push({ name: normalized, score });

    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, MAX_SCORES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    localStorage.setItem(PLAYER_NAME_KEY, normalized);
    return scores;
}

export function getPreferredPlayerName() {
    const value = localStorage.getItem(PLAYER_NAME_KEY);
    return value ? value.toUpperCase() : '';
}
