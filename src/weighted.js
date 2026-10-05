// Pick one candidate at random, weighted: [{ type, weight }]. Used by the Wanted Road's director and the mine's spawner.
export function chooseWeightedType(candidates) {
    let totalWeight = 0;
    for(const c of candidates) totalWeight += c.weight;
    if(totalWeight <= 0) return null;
    let r = Math.random() * totalWeight;
    for(const c of candidates) {
        r -= c.weight;
        if(r <= 0) return c.type;
    }
    return candidates[candidates.length - 1]?.type || null;
}
