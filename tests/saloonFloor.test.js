import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaloonFloor, SHIFT_WALK_SPEED, CUSTOMER_WALK_SPEED, REACH, KITCHEN_PATIENCE_BONUS } from '../src/saloonFloor.js';
import { SPOTS } from '../src/saloonKitchenLayout.js';
import { crowd, menu, settleShift, shiftPay, starsFor } from '../src/saloon.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';

const T0 = new Date('2026-10-01T08:00:00Z');

test('saloon floor initial state starts marshal at FLAP with correct crowd arrivals', () => {
    const floor = createSaloonFloor({ night: 1, seed: 1 });
    assert.equal(floor.state.marshal.x, SPOTS.FLAP.x);
    assert.equal(floor.state.marshal.z, SPOTS.FLAP.z);
    assert.equal(floor.state.pending.length, crowd(1));
    assert.equal(floor.over, false);
});

test('marshal walking to a station starts cooking for ordering customer', () => {
    const floor = createSaloonFloor({ night: 1, seed: 1 });
    // Advance time until first customer arrives and decides order
    while(floor.state.tickets.length === 0 && !floor.over) {
        floor.update(0.1);
    }
    assert.equal(floor.state.tickets.length, 1);
    const ticket = floor.state.tickets[0];

    // Move marshal to the station needed by the ticket
    const stationSpot = SPOTS[ticket.station.toUpperCase()];
    floor.moveTo(stationSpot.id);

    // Update until marshal arrives
    while(floor.state.marshal.path.length > 0) {
        floor.update(0.1);
    }

    // Check that job started at station
    assert.ok(floor.state.jobs[ticket.station].length > 0 || floor.state.readyPlates[ticket.station].length > 0 || floor.state.marshal.held.length > 0);
});

test('a complete trip: cook, pick up plate, deliver to seat and earn tip', () => {
    const floor = createSaloonFloor({ night: 1, seed: 1 });

    // Step 1: Wait until customer is ordering
    while(floor.state.tickets.length === 0) floor.update(0.1);
    const ticket = floor.state.tickets[0];
    const stationSpot = SPOTS[ticket.station.toUpperCase()];
    const seatSpot = SPOTS[`SEAT_${ticket.seatIndex + 1}`];

    // Step 2: Go to station to start cooking
    floor.moveTo(stationSpot.id);
    while(floor.state.jobs[ticket.station].length === 0 && floor.state.readyPlates[ticket.station].length === 0 && floor.state.marshal.held.length === 0) {
        floor.update(0.1);
    }

    // Step 3: Wait at station for plate to be cooked and picked up
    while(floor.state.marshal.held.length === 0) {
        floor.update(0.1);
    }
    assert.equal(floor.state.marshal.held[0].customerId, ticket.customerId);

    // Step 4: Walk to customer seat to deliver
    floor.moveTo(seatSpot.id);
    while(floor.state.served.length === 0) {
        floor.update(0.1);
    }

    assert.equal(floor.state.served.length, 1);
    assert.equal(floor.state.served[0].dish, ticket.dish);
    assert.ok(floor.state.served[0].tip >= 1);
    assert.equal(floor.progress().served, 1);
});

test('kitchen patience includes the bonus allowance', () => {
    const floor = createSaloonFloor({ night: 1, seed: 1 });
    while(floor.state.tickets.length === 0) floor.update(0.1);
    const ticket = floor.state.tickets[0];
    assert.ok(ticket.fullPatience >= 28 + KITCHEN_PATIENCE_BONUS);
});

test('unserved customer patience expiry counts as miss and resets streak', () => {
    const floor = createSaloonFloor({ night: 1, seed: 1 });
    // Let floor run idle without marshal moving
    while(floor.state.missed === 0 && !floor.over) {
        floor.update(0.5);
    }
    assert.ok(floor.state.missed > 0);
    assert.equal(floor.state.combo, 0);
});

test('new kitchen upgrades modify speed, tray carrying capacity, and stove burners', () => {
    const plain = createSaloonFloor({ night: 1, seed: 1 });
    assert.equal(plain.upgrades.boots, 0);
    assert.equal(plain.upgrades.tray, 0);
    assert.equal(plain.upgrades.burner, 0);

    const boots1 = createSaloonFloor({ night: 1, upgrades: { boots: 1 } });
    const boots2 = createSaloonFloor({ night: 1, upgrades: { boots: 2 } });
    boots1.moveTo('STOVE');
    boots2.moveTo('STOVE');
    boots1.update(0.5);
    boots2.update(0.5);
    assert.ok(boots2.state.marshal.x < boots1.state.marshal.x, 'boots level 2 moves faster than boots level 1');

    const tray2 = createSaloonFloor({ night: 1, upgrades: { tray: 2 } });
    tray2.state.readyPlates.stove.push({ customerId: 'c1', seatIndex: 0, dish: 'beans' });
    tray2.state.readyPlates.stove.push({ customerId: 'c2', seatIndex: 1, dish: 'beans' });
    tray2.state.readyPlates.stove.push({ customerId: 'c3', seatIndex: 2, dish: 'beans' });
    tray2.state.seats[0] = { id: 'c1', state: 'ordering' };
    tray2.state.seats[1] = { id: 'c2', state: 'ordering' };
    tray2.state.seats[2] = { id: 'c3', state: 'ordering' };
    tray2.moveTo('STOVE');
    while(tray2.state.marshal.path.length > 0) tray2.update(0.1);
    assert.equal(tray2.state.marshal.held.length, 3, 'tray level 2 allows carrying 3 plates');

    const burner = createSaloonFloor({ night: 1, upgrades: { burner: 1 } });
    burner.state.tickets.push({ id: 't1', customerId: 'c1', seatIndex: 0, dish: 'beans', station: 'stove', left: 20 });
    burner.state.tickets.push({ id: 't2', customerId: 'c2', seatIndex: 1, dish: 'beans', station: 'stove', left: 20 });
    burner.moveTo('STOVE');
    while(burner.state.marshal.path.length > 0) burner.update(0.1);
    assert.equal(burner.state.jobs.stove.length, 2, 'burner level 1 allows cooking 2 stove jobs in parallel');
});

test('summary format is compatible with settleShift', () => {
    const floor = createSaloonFloor({ night: 1, seed: 1 });
    // Deliver one customer
    while(floor.state.tickets.length === 0) floor.update(0.1);
    const ticket = floor.state.tickets[0];
    floor.moveTo(SPOTS[ticket.station.toUpperCase()].id);
    while(floor.state.marshal.held.length === 0) floor.update(0.1);
    floor.moveTo(SPOTS[`SEAT_${ticket.seatIndex + 1}`].id);
    while(floor.state.served.length === 0) floor.update(0.1);

    const summary = floor.summary();
    assert.equal(summary.action, 'shift');
    assert.equal(summary.night, 1);
    assert.ok(Array.isArray(summary.served));
    assert.equal(summary.served.length, 1);
    assert.ok('dish' in summary.served[0] && 'tip' in summary.served[0]);

    const p = createProfile(T0);
    p.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'dusty-pete')] = 1;
    p.town.saloon.nights = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const result = settleShift(p, summary, T0);
    assert.equal(result.served, 1);
    assert.ok(result.dollars > 0);
});
