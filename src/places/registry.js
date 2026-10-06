// Places you walk into (PLACES.md): Calloway Farm, Mr. Grimsby's parlour, and the eight to come. Each lives in its own file in
// src/places/ and is registered in src/places/index.js, so a new place is one new file and one line, with no edits to src/townPanel.js.
//
// A place is a factory: `create(host)` returns the place for one town screen. `host` is what the town screen lends it:
//   screen            the element the walk listens on
//   profile()         the player's profile (or null before it has loaded)
//   progress()        the Wanted Road progress
//   companion()       { adopted, following }, the dog
//   wallet, onProfile(profile), track(event), toast(text, isError), act(work, onError)   doing something for real and saying so
//   isCardOpen(), openBuilding(id), closeCard()   the card (sheet) the walk opens at a door
//   leave()           walk back out to the town
//   markVisited(id)   remember the player has been in a district
//   onDescend(floor)  start a mine run on a floor (the parlour's cellar: floor 1, or a checkpoint)
//
// A place is an object with:
//   id, sky, title()          its name for the header and its sky colours (src/townLook.js)
//   scene3d, walk             its 3D scene and its walking instance, once ensure() has run
//   entrance(spotId)          true when this walk spot (src/townSpots.js) is the way in
//   canEnter()                false while it is shut
//   ensure()                  build the scene and the walk (once)
//   card(id)                  the HTML of the card for a door inside it
//   click(button)             true when a button on its card was its own (plant, sell, ...)
//   resize(w, h)              optional
//   sync()                    optional: draw the profile into the scene, every render
//   prepare(), arrive(), entered()   optional hooks while going in: before the look changes, before the walk starts, once inside
const factories = [];

export function registerPlace(create) {
    if(typeof create !== 'function') throw new Error('registerPlace takes a factory function');
    factories.push(create);
}

// One instance of every registered place for a town screen.
export function createPlaces(host) { return factories.map(create => create(host)); }

// For tests: forget every registered place.
export function clearPlaces() { factories.length = 0; }
