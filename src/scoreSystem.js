const STORAGE_KEY = 'redWestScores';
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
    scores.push({ name: name.toUpperCase(), score });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, MAX_SCORES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    return scores;
}
