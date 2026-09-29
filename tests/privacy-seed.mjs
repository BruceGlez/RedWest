// Browser tests start as a player who already answered the first-launch question (src/privacy.js),
// so the question does not cover the home screen. tests/smoke.mjs checks the question itself.
export function answeredPrivacy() {
    localStorage.setItem('redWestPrivacy.v1', JSON.stringify({ ageBand: 'adult', statsConsent: false, answeredAt: '2026-01-01T00:00:00.000Z' }));
}
