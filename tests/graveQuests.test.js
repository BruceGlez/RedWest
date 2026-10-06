import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, GRAVE_COUNT, SOULS, graveQuest, graveQuests, questProgress, goalText, huntable, plural } from '../src/graveQuests.js';
import { mineRoster, monsterDef } from '../src/mineMonsters.js';

const ALL = ({ depths = [0, 1, 3, 6, 12, 25], days = 60 } = {}) => depths.flatMap(deepest => Array.from({ length: days }, (_, day) => graveQuests({ seed: 7, day, deepest }).map(q => ({ q, deepest }))).flat());

test('a quest is the same for the same seed, day, grave and deepest floor, and not the same for another day', () => {
    const a = graveQuest({ seed: 3, day: 100, grave: 2, deepest: 6 });
    assert.deepEqual(graveQuest({ seed: 3, day: 100, grave: 2, deepest: 6 }), a);
    assert.notDeepEqual(graveQuests({ seed: 3, day: 101, deepest: 6 }), graveQuests({ seed: 3, day: 100, deepest: 6 }));
    assert.notDeepEqual(graveQuests({ seed: 4, day: 100, deepest: 6 }), graveQuests({ seed: 3, day: 100, deepest: 6 }));
    assert.equal(a.id, '100:2');
    assert.deepEqual(graveQuest({ seed: 3, day: 100, grave: 2 + GRAVE_COUNT, deepest: 6 }), a, 'graves wrap round');
});

test('every grave has a soul with a mood and a line, and the six are different', () => {
    assert.equal(SOULS.length, GRAVE_COUNT);
    assert.equal(new Set(SOULS.map(s => s.name)).size, GRAVE_COUNT);
    for(const s of SOULS) assert.ok(['revenge', 'unfinished'].includes(s.mood) && s.line.length > 20 && s.line.length <= 160, s.name);
    assert.ok(SOULS.some(s => s.mood === 'revenge') && SOULS.some(s => s.mood === 'unfinished'));
    assert.equal(graveQuest({ day: 5, grave: 3 }).soul, SOULS[3]);
});

test('one grave a day is the main one, and the others use the small templates', () => {
    for(const deepest of [0, 5, 15]) {
        for(let day = 0; day < 80; day++) {
            const quests = graveQuests({ seed: 2, day, deepest });
            assert.equal(quests.filter(q => q.main).length, 1, `day ${day}: exactly one main grave`);
            for(const q of quests) assert.ok(q.main ? q.template === 'hunt' : TEMPLATES.includes(q.template));
        }
    }
    const seen = new Set(ALL().filter(({ q }) => !q.main).map(({ q }) => q.template));
    assert.deepEqual([...seen].sort(), [...TEMPLATES].sort(), 'find, hunt, clear and mix all turn up');
});

test('what is asked is something that lives where it is asked, and can be done from the deepest floor', () => {
    for(const { q, deepest } of ALL()) {
        assert.ok(q.goals.length >= 1 && q.goals.length <= 2);
        for(const goal of q.goals) {
            assert.ok(goal.count >= 1 && Number.isInteger(goal.count) && goal.floor >= 2);
            if(goal.type === 'kill') {
                assert.ok(mineRoster(goal.floor).includes(goal.monster), `${goal.monster} lives on floor ${goal.floor}`);
                assert.ok(monsterDef(goal.monster));
            } else assert.equal(goal.type, 'ore');
            if(q.main) assert.equal(goal.floor, Math.max(10, deepest + 3));
            else assert.ok(goal.floor <= Math.max(2, deepest + 2), `floor ${goal.floor} for deepest ${deepest}`);
        }
        const kinds = q.goals.map(g => g.type);
        assert.equal(new Set(kinds).size, kinds.length, 'one kill and one find at most');
        if(q.template === 'mix') assert.deepEqual([...kinds].sort(), ['kill', 'ore']);
        if(q.template === 'find') assert.deepEqual(kinds, ['ore']);
    }
});

test('a hunt names one creature; the main hunt is bigger, tougher, and has a posse of another kind', () => {
    for(const { q } of ALL()) {
        for(const goal of q.goals.filter(g => g.type === 'kill')) {
            if(q.template === 'hunt') {
                assert.equal(goal.count, 1);
                assert.match(goal.named, /^[A-Z -]+$/);
            }
            if(q.main) {
                assert.ok(goal.posse >= 2 && goal.posse <= 4);
                assert.ok(goal.posseKind && goal.posseKind !== goal.monster && mineRoster(goal.floor).includes(goal.posseKind));
            } else assert.equal(goal.posse, undefined);
        }
    }
});

test('quests grow with the player: what is asked from a deeper player is deeper and, for the same kind, no easier', () => {
    const floors = deepest => ALL({ depths: [deepest], days: 40 }).flatMap(({ q }) => q.goals.map(g => g.floor));
    const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
    assert.ok(mean(floors(10)) > mean(floors(4)) && mean(floors(4)) > mean(floors(0)));
    const ordinary = ALL({ depths: [0], days: 40 }).filter(({ q }) => !q.main).flatMap(({ q }) => q.goals.map(g => g.floor));
    assert.ok(Math.max(...ordinary) <= 2, 'a new player is not sent below floor 2 (only the main grave asks for floor 10)');
    assert.ok(huntable(2).length >= 1, 'floor 2 has something to hunt');
});

test('a quest names no reward, no timer, and nothing that can be bought or sold', () => {
    for(const { q } of ALL({ days: 10 })) {
        const keys = JSON.stringify(Object.keys(q)) + JSON.stringify(q.goals.map(g => Object.keys(g)));
        assert.ok(!/reward|nugget|dollar|star|expires|timer|minutes|price/i.test(keys), keys);
    }
});

test('progress is read from what the mine counted, and a quest is complete only when every goal is', () => {
    const q = { goals: [{ type: 'kill', monster: 'bat', count: 3, floor: 2 }, { type: 'ore', count: 5, floor: 2 }] };
    assert.deepEqual(questProgress(q, {}).goals.map(g => [g.have, g.need, g.done]), [[0, 3, false], [0, 5, false]]);
    assert.equal(questProgress(q, { kills: { bat: 3 }, ore: 2 }).complete, false);
    const done = questProgress(q, { kills: { bat: 9 }, ore: 5 });
    assert.equal(done.complete, true);
    assert.equal(done.goals[0].have, 3, 'more than asked counts as exactly what was asked');
    assert.equal(questProgress(q, { kills: { bat: '2.9' }, ore: -4 }).goals.map(g => g.have).join(), '2,0', 'rubbish counts as little');
    assert.equal(questProgress(q, { kills: { wolf: 50 } }).goals[0].have, 0, 'other kinds do not count');
    assert.equal(questProgress({ goals: [] }).complete, true);
});

test('the words read plainly, with the right plural', () => {
    assert.equal(plural('CAVE BAT'), 'CAVE BATS');
    assert.equal(plural('RIFLEMAN'), 'RIFLEMEN');
    assert.equal(plural('BRUTES'), 'BRUTES');
    assert.equal(goalText({ type: 'kill', monster: 'bat', count: 6, floor: 2 }), 'Kill 6 CAVE BATS on floor 2 or deeper.');
    assert.equal(goalText({ type: 'kill', monster: 'bat', count: 1, floor: 2 }), 'Kill 1 CAVE BAT on floor 2 or deeper.');
    assert.equal(goalText({ type: 'ore', count: 7, floor: 4 }), 'Bring up 7 ore from floor 4 or deeper.');
    for(const { q } of ALL({ days: 5 })) for(const g of q.goals) assert.ok(goalText(g).length > 12 && goalText(g).length <= 170, goalText(g));
});
