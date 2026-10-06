// The light of the Hollow Claim (MINE_PLAN.md, slice 5, "the dark mine"). The mine has no light of its own: the marshal carries a lantern that
// burns oil, and torches he places along the road. Pure rules with no rendering, like src/mineProgress.js, so the browser wallet, the server and
// the tests apply exactly the same ones; src/placeDark.js (the art lane) reads `lightSource` to draw the dark.
//
// House rules, checked by tests/mineLight.test.js:
// - Light is bought with earned Bounty Dollars and nothing else: never Gold Nuggets, never real money, no timers, no loot box. Every price below
//   is a dollar price, and `buyLight` touches `balances.dollars` only.
// - Light never changes combat. It changes what you can see. A player with no light at all still sees their own feet (DIM_RING), so nobody
//   is ever stuck: the lift and the shaft stay visible too (that rule is in src/mineMap.js and the scene).
// - Nothing is sold as a speed-up and nothing here has a timer to pay off.

// ---------- numbers (named so they can be tuned; the ones marked OPEN are the owner's to confirm, MINE_PLAN.md "Decided by the owner") ----------

export const DIM_RING = 6;            // radius of what you always see: your own feet (the art lane's MIN_RADIUS)
// The owner found the light too small (2026-10-06): both are nearly twice what they were (the lantern 15, a torch 12). Everything beyond is still black.
// A chamber is 22 to 30 units wide, so the lantern now lights about a chamber's width around the marshal, and a torch every TORCH_SPACING (40) units overlaps
// its neighbour a little (2 x TORCH_RADIUS is a little more than the spacing), so a torch road is one lit path with a dark cave to either side.
export const LANTERN_RADIUS = 28;     // radius the lit lantern throws around the marshal
export const TORCH_RADIUS = 22;       // radius a placed, burning torch lights
export const TORCH_SPACING = 40;      // about one torch every this many units of the road (src/mineMap.js roadLength)
export const MIN_TORCH_GAP = 14;      // a torch cannot be put closer than this to another (nothing gained by a pile)
export const CARRY_LIMIT = 10;        // torches he can carry (and own): about the most the first ten floors need
export const MATCH_LIMIT = 20;        // matches (a relight costs one)
export const OIL_CAPACITY = 900;      // seconds of lantern burn in a full lantern (OPEN: oil per refill)
export const THIN_AIR_FROM_FLOOR = 15; // from here the air is thin: a few placed torches go out by themselves, and the marshal has an oxygen bar (src/mineAir.js)
export const OIL_MIN_PRICE = 2;       // the least a top-up of oil costs, in dollars
export const MAX_HOLES = 12;          // how many torches the dark layer can show at once (src/placeDark.js)

// What the shops sell (Mr. Grimsby's and the general store, the town lane's cards): ids, what they give and their price in Bounty Dollars.
// OPEN, the owner confirms: exact prices. These are tuned so a first descent (lantern, a refill and a handful of torches) costs about what a
// short Wanted Road run earns, because the mine pays no money itself. Prices differ a little between the two shops (`SHOP_MARKUP`), nothing else.
export const LIGHT_ITEMS = {
    lantern: { name: 'LANTERN', blurb: 'Lights the ground around you while it has oil. Bought once.', dollars: 60 },
    oil: { name: 'LAMP OIL', blurb: 'Fills the lantern.', dollars: 15 },
    torches: { name: 'TORCHES x5', blurb: 'Five torches to place along the road. They light their place.', dollars: 20, gives: 5 },
    matches: { name: 'MATCHES x5', blurb: 'Relights a torch that went out.', dollars: 5, gives: 5 }
};
export const SHOP_MARKUP = { grimsby: 1.0, store: 1.1 }; // the general store charges a little more (rounded up)
// Ids and shop names come from the network: only the ones listed count ("constructor" and "__proto__" are not items or shops).
const has = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);
export const isLightItem = id => has(LIGHT_ITEMS, id);
// What a thing costs in a shop. Oil is sold by what the lantern is missing, so nobody pays the price of a full flask to add a minute: pass the kit (what he
// owns) for the top-up price; without it the price is the full flask's.
export const priceOf = (id, shop = 'grimsby', kit = null) => {
    const markup = has(SHOP_MARKUP, shop) ? SHOP_MARKUP[shop] : 1;
    if(id === 'oil' && kit && typeof kit === 'object') {
        const missing = Math.max(0, Math.min(OIL_CAPACITY, OIL_CAPACITY - whole(kit.oil)));
        return Math.max(OIL_MIN_PRICE, Math.ceil(LIGHT_ITEMS.oil.dollars * markup * missing / OIL_CAPACITY));
    }
    return Math.ceil(LIGHT_ITEMS[id].dollars * markup);
};

// Until the light shops (Mr. Grimsby's and the general store) are open, nobody could buy a lantern and the mine would be black for everyone, so
// a run starts with a full kit of its own. When the shops open, set this to true: the run then starts with what he owns (profile.mine.light).
export const LIGHT_NEEDS_SHOP = false;
export const FREE_KIT = { lantern: true, oil: OIL_CAPACITY, torches: CARRY_LIMIT, matches: MATCH_LIMIT };

// ---------- what a player owns (profile.mine.light) ----------

const whole = value => Math.max(0, Math.floor(Number(value)) || 0);

export function createLightKit() {
    return { lantern: false, oil: 0, torches: 0, matches: 0 };
}

// Whatever came from storage or the network: counts kept inside their limits, and oil only when there is a lantern to hold it.
export function normalizeLightKit(raw) {
    const kit = createLightKit();
    if(!raw || typeof raw !== 'object') return kit;
    kit.lantern = raw.lantern === true;
    kit.oil = kit.lantern ? Math.min(whole(raw.oil), OIL_CAPACITY) : 0;
    kit.torches = Math.min(whole(raw.torches), CARRY_LIMIT);
    kit.matches = Math.min(whole(raw.matches), MATCH_LIMIT);
    return kit;
}

// Buying light. `profile` is the whole profile (it spends profile.balances.dollars and fills profile.mine.light). Throws EconomyError-shaped
// errors (code and message) for the shop card to show; the profile is unchanged when it throws.
export function buyLight(profile, id, shop = 'grimsby') {
    if(!isLightItem(id)) throw lightError('unknown_item', 'That is not for sale.');
    const item = LIGHT_ITEMS[id];
    if(typeof shop !== 'string' || !has(SHOP_MARKUP, shop)) throw lightError('unknown_shop', 'That shop does not sell light.');
    const kit = profile.mine.light;
    if(id === 'lantern' && kit.lantern) throw lightError('owned', 'You already have a lantern.');
    if(id === 'oil' && !kit.lantern) throw lightError('no_lantern', 'You need a lantern to put oil in.');
    if(id === 'oil' && kit.oil >= OIL_CAPACITY) throw lightError('full', 'The lantern is full.');
    if(id === 'torches' && kit.torches >= CARRY_LIMIT) throw lightError('full', `You cannot carry more than ${CARRY_LIMIT} torches.`);
    if(id === 'matches' && kit.matches >= MATCH_LIMIT) throw lightError('full', `You cannot carry more than ${MATCH_LIMIT} matches.`);
    const price = priceOf(id, shop, kit); // (oil: by what the lantern is missing)
    if(profile.balances.dollars < price) throw lightError('funds', 'Not enough bounty dollars.');
    profile.balances.dollars -= price;
    if(id === 'lantern') { kit.lantern = true; kit.oil = OIL_CAPACITY; } // it comes full
    else if(id === 'oil') kit.oil = OIL_CAPACITY;
    else if(id === 'torches') kit.torches = Math.min(CARRY_LIMIT, kit.torches + item.gives);
    else if(id === 'matches') kit.matches = Math.min(MATCH_LIMIT, kit.matches + item.gives);
    return { id, price };
}
function lightError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

// After a run: take away what was used (`used` = { oil, torches, matches }, from the run's summary). Never below nothing, never more than he had.
export function spendKit(kit, used) {
    const u = used && typeof used === 'object' ? used : {};
    kit.oil = Math.max(0, kit.oil - Math.min(whole(u.oil), OIL_CAPACITY));
    kit.torches = Math.max(0, kit.torches - whole(u.torches));
    kit.matches = Math.max(0, kit.matches - whole(u.matches));
    return kit;
}

// ---------- a run (client side; nothing here is saved until the run's summary is reported) ----------

// What a run starts with: what he owns, or the free kit while LIGHT_NEEDS_SHOP is false.
export const kitForRun = own => LIGHT_NEEDS_SHOP ? normalizeLightKit(own) : { ...FREE_KIT };

// The state of the light for one run, taken from the kit he goes down with.
export function createLightRun(kit) {
    const own = normalizeLightKit(kit);
    return { lantern: own.lantern, oil: own.oil, oilStart: own.oil, torches: own.torches, torchesStart: own.torches, matches: own.matches, matchesStart: own.matches,
        placed: [] }; // placed torches: { x, z, floor, lit, litAt, floorSeconds }
}

export const lanternLit = run => run.lantern && run.oil > 0;

// The lantern burns while the run goes on (call with the seconds that passed).
export function burnLantern(run, seconds) {
    if(!run.lantern) return;
    run.oil = Math.max(0, run.oil - Math.max(0, Number(seconds) || 0));
}

// ---------- thin air: from THIN_AIR_FROM_FLOOR a few placed torches go out by themselves ----------
// "Torches go out for lack of oxygen, randomly, not all of them, just a few; the deeper you go the more it becomes an issue" (owner, 2026-10-06). Each torch gets,
// when it is put down, a time after which it goes out, or never. Which ones, and when, comes from the floor and the torch's number on it, so the same floor
// goes the same way every time and a test can fix it. The first torch of a floor never fails and no more than half of them are chosen, so the way back is
// never all dark. A dead torch is the same smoking stub a light eater leaves, and a match relights it.
export const TORCH_FAIL_BASE = 0.10;       // the share of torches that fail on the first thin floor
export const TORCH_FAIL_PER_FLOOR = 0.025; // and how much more each floor deeper
export const TORCH_FAIL_CAP = 0.5;         // never more than half
export const TORCH_FAIL_MIN_SECONDS = 60, TORCH_FAIL_SPREAD_SECONDS = 300; // a failing torch lasts between 1 and 6 minutes
export const torchFailChance = floor => floor < THIN_AIR_FROM_FLOOR ? 0 : Math.min(TORCH_FAIL_CAP, TORCH_FAIL_BASE + TORCH_FAIL_PER_FLOOR * (Math.floor(floor) - THIN_AIR_FROM_FLOOR));
const hash01 = text => { let h = 2166136261; for(const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
// How long torch number `index` of `floor` burns before the air puts it out (its `relights`th light), in seconds, or Infinity for one that never fails.
export function torchFailAfter(floor, index, relights = 0) {
    const chance = torchFailChance(floor);
    if(chance <= 0 || (index === 0 && relights === 0)) return Infinity;
    const roll = hash01(`torch-${Math.floor(floor)}-${index}-${relights}`);
    return roll < chance ? TORCH_FAIL_MIN_SECONDS + (roll / chance) * TORCH_FAIL_SPREAD_SECONDS : Infinity;
}

// Put a torch down where the marshal stands, on `floor`. Returns the torch, or null (none left, or one is already close).
export function placeTorch(run, x, z, floor) {
    if(run.torches <= 0) return null;
    if(run.placed.some(t => t.floor === floor && Math.hypot(t.x - x, t.z - z) < MIN_TORCH_GAP)) return null;
    run.torches--;
    const index = run.placed.filter(t => t.floor === floor).length;
    const torch = { x, z, floor, lit: true, burned: 0, index, relights: 0, failAfter: torchFailAfter(floor, index, 0) };
    run.placed.push(torch);
    return torch;
}

// A torch is put out (by a light eater, src/mineMonsters.js, or by the thin air below).
export function putOutTorch(torch) { torch.lit = false; }

// Relight a torch with a match. Returns true when it is lit again; false when there are no matches or it was not out.
export function relightTorch(run, torch) {
    if(torch.lit || run.matches <= 0) return false;
    run.matches--;
    torch.lit = true;
    torch.burned = 0;
    torch.relights = (torch.relights || 0) + 1;
    torch.failAfter = torchFailAfter(torch.floor, torch.index || 0, torch.relights); // (a torch that was lit again may fail again, at a time of its own)
    return true;
}

// Lit torches of this floor burn, and in thin air the ones chosen go out when their time comes (call with the seconds that passed, on the floor being
// played). Returns the torches the air just put out, so the mode can say so.
export function burnTorches(run, floor, seconds) {
    const out = [];
    if(floor < THIN_AIR_FROM_FLOOR) return out;
    for(const t of run.placed) {
        if(t.floor !== floor || !t.lit || !Number.isFinite(t.failAfter)) continue;
        t.burned += seconds;
        if(t.burned >= t.failAfter) { t.lit = false; out.push(t); }
    }
    return out;
}

// What the dark layer needs: the radius of the marshal's own light, and the lit torches of this floor, nearest first (at most MAX_HOLES):
// { radius, holes: [{ x, z, r, k }] }. The radius is the lantern's while it has oil, else the dim ring you always have.
export function lightSource(run, floor, at) {
    const radius = lanternLit(run) ? LANTERN_RADIUS : DIM_RING;
    const holes = run.placed
        .filter(t => t.floor === floor && t.lit)
        .map(t => ({ x: t.x, z: t.z, r: TORCH_RADIUS, k: 1, d: at ? Math.hypot(t.x - at.x, t.z - at.z) : 0 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX_HOLES)
        .map(({ x, z, r, k }) => ({ x, z, r, k }));
    return { radius, holes };
}

// Is a point lit at all (by the marshal's light or a torch)? For rules that need to know (a light eater goes for lit torches; a monster may sense a lit marshal).
export function isLit(run, floor, at, x, z) {
    const { radius, holes } = lightSource(run, floor, at);
    if(Math.hypot(x - at.x, z - at.z) <= radius) return true;
    return holes.some(h => Math.hypot(x - h.x, z - h.z) <= h.r);
}

// The nearest lit torch of this floor within `reach` of (x, z), or null (a light eater goes for it).
export function nearestLitTorch(run, floor, x, z, reach = Infinity) {
    let best = null, bestD = reach;
    for(const t of run.placed) {
        if(t.floor !== floor || !t.lit) continue;
        const d = Math.hypot(t.x - x, t.z - z);
        if(d <= bestD) { best = t; bestD = d; }
    }
    return best;
}

// The torch of this floor within `within` of (x, z) that is out (a stub), nearest first, or null: T near it relights it.
export function nearestOutTorch(run, floor, x, z, within = MIN_TORCH_GAP) {
    let best = null, bestD = within;
    for(const t of run.placed) {
        if(t.floor !== floor || t.lit) continue;
        const d = Math.hypot(t.x - x, t.z - z);
        if(d <= bestD) { best = t; bestD = d; }
    }
    return best;
}

// What the run used, for the summary the server applies to the kit: { oil, torches, matches }.
export function usedKit(run) {
    return { oil: Math.ceil(run.oilStart - run.oil), torches: run.torchesStart - run.torches, matches: run.matchesStart - run.matches };
}

// How many torches a road needs: about one every TORCH_SPACING units.
export const torchesFor = length => Math.ceil(Math.max(0, length) / TORCH_SPACING);
