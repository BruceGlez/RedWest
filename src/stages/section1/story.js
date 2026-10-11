// Section 1's words (docs/design/pete-section1-gameplay.md, section 3): Miner Odell at the Trailhead fire, the beats the run reaches, the
// objective line for each. Voice: serious and warm, loss told by what you walk through. Every line is at most 200 characters (the dialogue box).
// The Company is Meridian Land and Rail; Marshal Flint Reed asks before he shoots. Copy for the story lane to polish; the logic does not change.

export const ODELL = {
    id: 'ODELL',
    speaker: 'Miner Odell',
    // Where he sits: by the Trailhead fire (I01 at -520, -575), looking at it.
    at: { x: -528, z: -575, face: Math.PI / 2 },
    first: [
        "Easy, Marshal. I'm Odell. I dug this ground for Copper Bit until Meridian Land and Rail called it theirs and sent men with rifles.",
        'The foreman kept a payroll book, every wage they never paid. The Company wants it burned. Find it before they do.',
        'The guards sleep by the fire and hold the Claims ahead. Watch the shack doors. Some of us left things behind. Here, take this for the road.'
    ],
    again: ['Mind the Claims, Marshal. Watch the shack doors, and keep low in the grass.'],
    healAmount: 1
};

export const BEAT_LINES = {
    ledger: 'CLAIM LEDGER PAGE: the Company stamped the evictions. Keep it for the Case File.',
    claims: "ODELL: That was the Company's rent crew. The payroll book is on the road ahead.",
    bridge: 'The Company pays by the claim, not by the day. The road goes on to the Hairpin.'
};

// The HUD's objective line for where the run stands.
export function objectiveFor(run) {
    const beats = run?.s1?.state?.beats ?? {};
    if(run?.exitOpen && run.clearedEncounters?.includes('a1-flume-ambush')) return 'FOLLOW THE ROAD TO THE HAIRPIN';
    if(run?.currentZone?.id === 'flume') return 'CROSS THE FLUME BRIDGE';
    if(beats.claims) return 'HEAD FOR THE FLUME';
    if(beats.witness) return "FIND THE FOREMAN'S PAYROLL BOOK";
    return 'FOLLOW THE CLAIMS ROAD';
}
