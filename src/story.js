import { STAR_DEFEATED, STAR_HOT_BOUNTY, STAR_ESCAPED } from './progress.js';

// The story of chapter one, "The Ledger" (STORY_BIBLE.md). Per outlaw: three story cards and one ledger page.
// The cards unlock with the three stars, in the order of STAR_GOALS in outlaws.js:
//   card 1 (defeat the outlaw): who they are, and what the world says about them
//   card 2 (collect the bounty at Heat 2+): what the Company paid or promised them; this also earns the ledger page
//   card 3 (ride on and escape): what becomes of them once they are in Lantern Rock
// Serious voice; loss is told, never shown, and nobody is shown dying (the game has an under-13 mode).
// Keyed by outlaw id, so a new outlaw at the end of OUTLAWS only needs its own entry. Keep every card under
// CARD_MAX characters and every page under PAGE_MAX; tests/story.test.js checks it.

export const CARD_MAX = 300;
export const PAGE_MAX = 170;

// The star bit that unlocks each card, in order.
export const CARD_STARS = [STAR_DEFEATED, STAR_HOT_BOUNTY, STAR_ESCAPED];

export const STORY = {
    'dusty-pete': {
        cards: [
            { title: 'The Tin Cup', text: 'Pete ran the Tin Cup, the loudest saloon in Copper Bit, and kept a piano no one could play. When the Company\'s rent collectors came, he was the man they paid to answer the door.' },
            { title: 'A Receipt', text: 'Every claim Pete talked a miner into selling earned him a small payment. Flint reads the receipt twice: for rough work, $50. It is what the Company pays for a fence post.' },
            { title: 'The Benches', text: 'Pete takes the jail\'s work sentence and mends every bench in Lantern Rock. By spring he keeps the peace outside the saloon, and nobody has to ask him not to hit anyone.' }
        ],
        page: { title: 'Receipt, Copper Bit', text: 'Received of Meridian Land & Rail, for rough work: $50. One claim, sold.' }
    },
    'rattlesnake-rosa': {
        cards: [
            { title: 'Runs With Wolves', text: 'Rosa wears a wolf-fang necklace and a mantle of grey fur, and the wolves of Whisper Wash follow her. Travellers call her cruel. The wolves say nothing.' },
            { title: 'Salt In The Well', text: 'The Company poisoned the last clean waterhole to drive the homesteaders out. The wolves came down from the hills looking for water, and Rosa raised the pups. Her proof is a supply order, signed by a Company agent.' },
            { title: 'Past Lantern Rock', text: 'Rosa leads the pack out of the wash to good land beyond Lantern Rock. She takes the jail\'s work sentence herself, and keeps one promise: no animal in her care goes thirsty again.' }
        ],
        page: { title: 'Order, Whisper Wash', text: 'For the Whisper Wash wells: six barrels of salts. Deliver quietly. Do not sign locally.' }
    },
    'deacon-graves': {
        cards: [
            { title: 'The Bell Tower', text: 'The Deacon was a preacher until his church burned. Now he keeps the bell tower at Hollow Hill and judges every rider who climbs it, one measured shot at a time.' },
            { title: 'The Deed', text: 'The Company bought the chapel\'s mortgage the week before the fire. The deed is stamped with the Cinder Creek water claim: the first thread that ties the fire to the Company\'s ledger.' },
            { title: 'A Service For The Jail', text: 'Each Sunday the Deacon holds a service for the jail\'s other guests. He rings a small bell now, and it is no longer a warning.' }
        ],
        page: { title: 'Mortgage, Hollow Hill', text: 'Chapel mortgage bought by the Company. Cinder Creek water claim stamped the same week.' }
    },
    'calloway-gang': {
        cards: [
            { title: 'Twin Forks', text: 'The Calloway brothers work one farm and share one debt. Their father\'s dynamite is the only thing on the land the bank does not own.' },
            { title: 'The Small Print', text: 'The loan hides one clause: a single late payment gives the lender the land. The brothers robbed the bank because the bank was the Company, and the paper was the whole crime.' },
            { title: 'Fences', text: 'The brothers rebuild the fences outside Lantern Rock and stay on to farm. The jail\'s guards say it is the only work sentence anyone has asked to extend.' }
        ],
        page: { title: 'Loan Agreement, Twin Forks', text: 'Clause 14: any late payment forfeits the land to the lender. Lender: Meridian Land & Rail.' }
    },
    'iron-jack': {
        cards: [
            { title: 'Bulletproof, They Say', text: 'Everyone in Red West says Iron Jack cannot be shot. He has never said so himself. The iron on him is riveted shut, and it was not his idea.' },
            { title: 'One Man, Do Not Remove', text: 'Ezra Stone reads the foundry\'s work order: one suit of proof armour, one man, do not remove. Then he finds the hidden bolt on the back, and understands what the Company meant by a test.' },
            { title: 'The Smithy', text: 'Ezra opens the armour, and Jack stands up straight for the first time in years. He asks whether the smithy has work for a man his size.' }
        ],
        page: { title: 'Work Order, Slagtown', text: 'One suit of proof armour. One man. Rivets closed. Do not remove.' }
    },
    'mesa-morgan': {
        cards: [
            { title: 'Queen Of The Badlands', text: 'Morgan was the quarry foreman at Redstone Mesa before the railroad\'s blasting crews arrived. She kept the dynamite, and the riders who worked for her.' },
            { title: 'The Dry Channel', text: 'The Company blasted a tunnel through the mesa\'s spring and called it progress. Morgan takes Flint across the rope bridge to the dry channel, and shows him the permit.' },
            { title: 'The Fire Crew', text: 'Morgan leads Lantern Rock\'s volunteer fire crew. She uses dynamite for controlled burns, and has not lost a building yet.' }
        ],
        page: { title: 'Blasting Permit, Redstone Mesa', text: 'Permit to blast the north face. Effect on the mesa\'s spring: not to be recorded.' }
    },
    'silas-vane': {
        cards: [
            { title: 'Six-Gun Silas', text: 'Silas has never lost a duel, and it has emptied his life. The town around his crossing has dried up, because nobody will cross it.' },
            { title: 'A Standing Fee', text: 'The Company paid Silas a standing fee to keep Vane\'s Crossing closed. No wagon train could use the pass, so the only way west was the Company\'s railroad.' },
            { title: 'The Gallery', text: 'After he loses to the marshal, the Crossing reopens. Silas opens a small shooting gallery on Lantern Rock\'s main street, and charges a nickel to try to beat him.' }
        ],
        page: { title: 'Standing Order, Vane\'s Crossing', text: 'Monthly fee to S. Vane. Condition: the Crossing stays closed to wagons.' }
    },
    'el-espectro': {
        cards: [
            { title: 'The Ghost Of Red West', text: 'Travellers say a ghost in a white coat haunts the ruins of Tres Rios. The people who live near it say something different: a man lives there, and his riders are his neighbours.' },
            { title: 'Don Rafael', text: 'He is Rafael Ibarra, last owner of the Tres Rios land grant. The Company took the estate with forged papers, and he let the ghost story keep them away. He tells Flint what he saw the night Cinder Creek burned: the Company\'s own men, carrying lamps.' },
            { title: 'The Front Porch', text: 'Flint restores Rafael\'s name in the town records. He does not take a cell. He takes the chair on the jail\'s front porch, and the people of Tres Rios come to visit.' }
        ],
        page: { title: 'Land Grant, Tres Rios', text: 'The Ibarra grant, and a Company letter: "The papers we filed are not genuine. Proceed regardless."' }
    },
    'lucky-lou': {
        cards: [
            { title: 'The Silver Belle', text: 'Lou runs a riverboat casino where the Company\'s money goes in dirty and comes out clean. She smiles at everyone and remembers every name on the payroll.' },
            { title: 'The Casino Ledger', text: 'Lou keeps a second set of books: every payment the Company made to every outlaw before her. She will trade them, but only for a game. Win the duel, and the ledger is yours.' },
            { title: 'An Honest Table', text: 'Lou deals cards at the Lantern Rock saloon now, and the table is honest. She says it is the first game she has played where she did not know how it ends.' }
        ],
        page: { title: 'Casino Ledger, The Silver Belle', text: 'Nine names, nine payments, each dated the week their trouble began.' }
    },
    'colonel-crane': {
        cards: [
            { title: 'The Colonel', text: 'Colonel August Crane found a boy on the trail after Cinder Creek burned and raised him at Fort Pell. Years later the Company bought the fort\'s debts, and Crane wears its orders like a uniform.' },
            { title: 'The Original Order', text: 'The order to clear the valley bears the president\'s name, Ambrose Thorne, and the same eight-point compass seal as every other page. Below it, in the staff list: W. Reed, guide, retained. Flint\'s father is alive, and the Colonel has known for years.' },
            { title: 'Testimony', text: 'Crane is brought in without cuffs. He tells the court everything, and he tells Flint where the survey camp is that his father guides for.' }
        ],
        page: { title: 'The Original Order', text: 'Clear the valley. A. Thorne, President. Staff: W. Reed, guide, retained.' }
    }
};

// Shown in the Case File once all ten pages are held. Chapter one ends on a question, not a full stop.
export const CHAPTER_ONE_END = {
    title: 'The Ledger, Complete',
    text: 'The ten pages go to the territorial court, and Ambrose Thorne is arrested. Before they take him, he says one thing: he was never the one giving the orders.\n'
        + 'Every page carries the same eight-point compass seal. The next morning a new poster hangs on the sheriff\'s wall: no name, only a face and a compass rose.\n'
        + 'Far to the north a survey camp waits for its guide. The Wanted Road is not finished.'
};

export function storyFor(outlawId) {
    return STORY[outlawId] ?? null;
}

// Which cards a star mask has unlocked, as booleans in card order.
export function unlockedCards(mask) {
    return CARD_STARS.map(bit => (mask & bit) !== 0);
}

// The ledger page comes with the second star (collect the bounty at Heat 2+).
export function hasPage(mask) {
    return (mask & STAR_HOT_BOUNTY) !== 0;
}

// The pages held, as outlaw indexes.
export function pagesHeld(progress) {
    return progress.stars.map((mask, i) => (hasPage(mask) ? i : -1)).filter(i => i >= 0);
}

export function caseComplete(progress, outlawCount) {
    return pagesHeld(progress).length >= outlawCount;
}

// Each panel has a picture (public/story/, made with tools/story-picture.mjs from tools/story-prompts.mjs).
// The opening: what a first-time player reads once, before the first ride (four short panels, skippable). Flint's
// arrival, and why the Wanted Road matters. The last line of the first panel is the Drifter, a rumour on the road.
export const OPENING = [
    { title: 'Red West', image: 'story/opening-1.webp', text: 'A territory of red mesas, dry rivers and one long railroad. The law is thin, water is money, and a company is quietly buying everything. They say a rider walks the Wanted Road whom no one has ever seen grow old. Nobody has seen him leave.' },
    { title: 'Cinder Creek', image: 'story/opening-2.webp', text: 'Flint Reed grew up in Cinder Creek. When he was fourteen a fire took the settlement in a night. The Company called it a bandit raid, and its water rights changed hands the next week. His father never came back from the trail.' },
    { title: 'The Star', image: 'story/opening-3.webp', text: 'A colonel raised him at Fort Pell. At twenty-two Flint refused an order to clear a valley, rode out, and earned his own star. Now he has the hardest posting in the territory: Red West.' },
    { title: 'Lantern Rock', image: 'story/opening-4.webp', text: 'The train stops at Lantern Rock, a small town that hangs its lamps every evening so travellers can find it across the dark. Ten names are on the Wanted Road. Flint means to ask each of them the same question: who paid you?' }
];

// The ending of chapter one, in three panels (the Case File shows the same text as one card).
export const ENDING = [
    { title: 'The Court', image: 'story/ending-1.webp', text: 'The ten pages go to the territorial court, and Ambrose Thorne is arrested. Before they take him, he says one thing: he was never the one giving the orders.' },
    { title: 'The Seal', image: 'story/ending-2.webp', text: 'Every page carries the same eight-point compass seal. Flint has seen it ten times now, in ten different hands, and it has never once been signed.' },
    { title: 'The Poster', image: 'story/ending-3.webp', text: 'The next morning a new poster hangs on the sheriff\'s wall: no name, only a face and a compass rose. Far to the north a survey camp waits for its guide. The Wanted Road is not finished.' }
];
