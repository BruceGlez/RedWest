# Red West story bible

Written 2026-09-29, updated the same day with the owner's answers (section 10). Names, places and plot points can
still be swapped. **In the game so far:** each outlaw's home ground, ride-in line and short bio (`home`, `taunt`,
`bio` in `src/outlaws.js`, shown in the ride-in banner and the Bounty Book). Everything else is proposed. It is built on what already exists in the code (the ten outlaws in
`src/outlaws.js`, their picture prompts in `tools/character-prompts.mjs`, the enemy roster in `src/enemyTypes.js`,
the Frontier Town buildings in `src/town.js`, the perks in `src/perks.js`), so the story fits the game as it plays.
Research sources are at the end.

## 1. The rules for the writing

- **Tone: serious (owner's decision).** Plain, weighty, spare lines: a Western about debt, water, land and
  second chances, not a comedy. The art is chunky and toy-like and the game has an under-13 mode
  (`src/privacy.js`), so it stays fit for everyone: fights are stylised, nobody is shown dying, and loss is told,
  not shown. Serious does not mean grim: the outlaws are people with reasons, and the story is hopeful.
- **Every outlaw is a person first.** Each wants something understandable. That is what makes "beat them, jail
  them, and later play as them" (the game's existing loop) feel earned, not arbitrary.
- **Original only.** No characters, places, plots or names from other games, films or real people (the rule in
  `ASSETS.md`). Do a name and trademark search before release (`GROWTH_PLAN.md`).
- **Respect.** No stereotypes of real peoples or communities; nobody is a villain because of where they come
  from. El Espectro's story (below) is written to that standard.
- **Story is short, skippable and never blocks play.** Sessions are minutes long on a phone. A story beat is a
  screen you can read in ten seconds or tap past. Nothing is locked behind reading.

## 2. The world

**Red West** is a territory of red mesas, dry rivers and one long railroad, a few years after the frontier wars.
The law is thin, water is money, and a company is quietly buying everything.

- **Lantern Rock** is the player's home: a small brick-and-timber town at dusk with a steam train depot, the town
  you build between runs (the Frontier Town in `src/townScene.js`). It is named for the lamps the townsfolk hang
  every evening so travellers can find it across the dark desert.
- **The Wanted Road** is the trail of ten outlaws, each with a home ground of their own (section 5).
- **Meridian Land & Rail** ("the Company") owns the railroad, most of the water rights, and, as it turns out, the
  ten outlaws. It never appears in a fight. It is the thing behind the fights.

## 3. Theme and the story in one paragraph

**Theme: everyone deserves a second chance, but the ones who profit from your worst day do not.** Marshal Flint
Reed rides into Red West to bring in ten wanted outlaws. Along the way he learns that none of them acted alone:
each was pushed, paid or cornered by the Company, which wanted the territory lawless so it could sell "order".
Every outlaw he beats pays a bounty, then (the game's existing rule) works off their sentence in Lantern Rock's
jail, and the ones he wins over become allies he can play. By the tenth, the ten pages of the Company's secret
ledger are in his hands, and the last outlaw is the man who taught him to ride. **The story is open-ended by
design** (section 4b): ten stages is chapter one, the Company turns out to be a front for a bigger power, and
Flint's father is alive.

## 4. The hero: Marshal Flint Reed

**Who he is.** A lawman in a wide brown hat with a gold star, a handlebar moustache, an orange duster, a red
bandana and one revolver (the marshal picture prompt in `tools/character-prompts.mjs`). Confident, dry, patient,
and slightly too proud of his aim.

**Where he comes from.**
- Born Flint Reed in **Cinder Creek**, a small ranching and mining settlement at the far edge of the territory.
  His father, **Wick Reed**, was a wagon-master; his mother, **Ada**, taught the settlement's children to read.
- When Flint was fourteen, a fire swept Cinder Creek in the middle of the night. The Company's report called it
  a bandit raid. The settlement was gone by morning and the water rights to its creek changed hands the next
  week. Wick, out on the trail with a wagon train, never came back. **He is alive** (owner's decision): the Company kept
  him as a guide, the only man who knew every crossing in the territory, and he has been working for them under
  threat ever since. Flint does not know this until the end of chapter one (section 4b).
- A cavalry colonel, **August Crane**, found the boy on the trail, took him in at **Fort Pell** and raised him as
  a scout. Flint learned to ride, track and shoot from the man who would become the tenth outlaw.
- At twenty-two, Flint was ordered to help clear settlers from a valley for the Company. He refused, was called
  a deserter, and rode out. He earned his star as a lawman and took the hardest posting, Red West, the territory
  where Cinder Creek used to be.

**What he wants.** Justice for the fire, and to prove that the law is not for sale.
**What he needs.** To learn that bringing someone in and giving them a second chance can be one act.
**His flaw.** He believes law is a line, and that people stay on their side of it.
**His arc.** He starts by hunting outlaws for the bounty. He ends by asking each one what they were paid, and
what they were promised, and finding out the answer is the same every time.
**His voice.** Short, level, understated; he asks before he shoots. "Who paid you?" "I'm not here to hurt you, Pete. I'm here to find out what you were told."

**His people (all already in the game):**
- **Deputy June Holloway** (a hired hand, `src/perks.js`): a young sharpshooter with an auburn bob and a silver
  star. Runs the Sheriff's Office in Lantern Rock and posts the daily jobs. Direct, sharp, keeps the case board of ledger
  pages. She joins him from the start.
- **Ezra Stone** (a hired hand): the town blacksmith, big and gentle, turned gunsmith. Runs the gunsmith's shop.
  Knows metal, which matters at Iron Jack's foundry.
- **The jail's guests:** every outlaw Flint beats.

## 4b. Chapters: an ending that stays open

The game has ten stages today and will get more (`src/outlaws.js`: new stages are added at the end so saved stars keep
their places). So the story is built in **chapters**, and chapter one is written to end on a question, not a full stop.

- **Chapter one, "The Ledger" (stages 1 to 10, the game today).** Ten outlaws, ten ledger pages, one arrest.
  It resolves the Cinder Creek fire and the Company's hold on Red West, and it ends on three open threads:
  1. **The Compass.** Every ledger page carries the same embossed **eight-point compass seal**. Thorne, the Company's
     president, was a front: the orders came from **the Compass Board**, a group of distant financiers who want
     the whole railroad and every water right from the mountains to the sea. It is named only at the very end.
  2. **Wick Reed is alive.** He is guiding a Company survey camp far to the north.
  3. **The last poster.** A new Wanted poster on the sheriff's wall, with a face and a compass rose but no name.
- **Chapter two, "The Compass" (stages 11 and up, not written).** Flint follows the pages north, beyond Red West:
  mountain passes, a border river, a coastal port, the northern rail. Each new region brings new outlaws with the
  same shape as chapter one: a person first, wronged or paid by the Board, with a home ground, three story cards
  and a page (now a **compass fragment**) of the Board's map. The chapter ends on Wick.
- **Rules for adding stages, so the story never has to be rewritten:**
  - A new stage is one new outlaw with a home ground, a ride-in line, a bio, and three story cards. Nothing else
    is required; no stage may depend on a later one.
  - Every chapter has one arc, one reveal, and one unresolved thread that the next chapter picks up.
  - Beaten outlaws always end in the jail and, if unlocked, the shop, so the town keeps growing.
  - The compass seal appears on every page in every chapter. When a player sees it, they know who is behind it.

## 5. The ten outlaws and their worlds

Each stage is a place with its own light, sound and props, an enemy that belongs to it, and three story beats
that unlock with the three stars (`STAR_GOALS` in `src/outlaws.js`):

- **Star 1, "Defeat the outlaw":** their *bio card*: who they are and what the world says about them (the short `bio` in the game today is its first line).
- **Star 2, "Collect the bounty at Heat 2+":** their *confession*: what the Company paid or promised them, and
  one **ledger page** as proof.
- **Star 3, "Ride on and escape":** their *epilogue*: they take the jail's work sentence and, for the ones who
  unlock as playable characters (`src/perks.js`), join the marshal.

The ten ledger pages are the collectible spine of the story: page one at Dusty Pete, page ten at Colonel Crane.
The pages are *evidence*: each records a payment, a promise or an order from the Company.

| # | Outlaw (bounty) | Home ground | Light and mood | Belongs to them |
|---|---|---|---|---|
| 1 | Dusty Pete ($50) | **Copper Bit**, a tumbledown mining-town saloon street | Harsh noon, hitching posts, spilled kegs, a broken piano | bandits |
| 2 | Rattlesnake Rosa ($75) | **Whisper Wash**, a dry riverbed canyon | Moonlit blue night, howls, dry brush | wolves and rattlers |
| 3 | Deacon Graves ($100) | **Hollow Hill Chapel**, a burnt-out church and graveyard | Purple dusk, candle glow, tombstones, a bell tower | riflemen |
| 4 | The Calloways ($125) | **Twin Forks**, a big farm and its little bank | Warm afternoon, barn, hay wagons, a bank with a new hole | dynamiters |
| 5 | Iron Jack Harlan ($150) | **Slagtown**, the Company's foundry yard | Grey smoke, furnace glow, rails, iron dust | brutes |
| 6 | Mad Mesa Morgan ($200) | **Redstone Mesa**, a quarry cut by rope bridges | Blazing red rock, blast dust, cliff edges | riders |
| 7 | Silas Vane ($250) | **Vane's Crossing**, a ghost-town main street | High-noon glare, a stopped clock, wind | duelists |
| 8 | El Espectro ($350) | **Tres Ríos**, an abandoned ranch estate in fog | Moon-white mist, ruined arches, drifting lanterns | ghost riders |
| 9 | Lucky Lou ($400) | **The Silver Belle**, a riverboat casino on the Painted River | Warm lamps, paddlewheel, cards, brass | knife throwers |
| 10 | Colonel Crane ($450) | **Fort Pell**, a cavalry fort in the cold | Cold blue dusk, snow on the ramparts, flags | troopers |

### 1. Dusty Pete: "The Saloon Brawler" (Copper Bit)
- **Who:** a burly, scruffy brawler with a bushy brown beard and a crooked grin, the Company's muscle for
  collecting "rent" on the miners' claims. Loud, dented, secretly sentimental.
- **Wants:** to keep his saloon, The Tin Cup, and its piano, out of the Company's hands.
- **Home ground and bio (in the game):** Copper Bit. Muscle for the Company's rent collectors in Copper Bit. He breaks what will not sell, and keeps every receipt.
- **Confession (page 1):** the Company gave him a small payment for every claim he "convinced" to sell. Page one
  is a receipt: *For rough work, $50.* He hadn't noticed it was the same rate as a fence post.
- **Epilogue:** he takes the jail's work sentence, mends the town's benches, and becomes Lantern Rock's bouncer.
  As a hero: *Barroom Brawler* (long dashes).
- **Ride-in line (in the game):** “I was paid to break what would not sell. Today that is you.”

### 2. Rattlesnake Rosa: "Runs With Wolves" (Whisper Wash)
- **Who:** a fierce outlaw with a long braid, a green coat and a grey wolf-fur mantle, a wolf-fang necklace on her
  neck. Calls the wolves with a howl. Her "pets" are rattlers (the Rattler enemy).
- **Wants:** the wolves and the wash to be left alone. The Company poisoned the last clean waterhole to force
  homesteaders out, and the wolves came down from the hills looking for water, so she raised the pups.
- **Home ground and bio (in the game):** Whisper Wash. Raised the wolf pups when the Company poisoned the wells of Whisper Wash. She has forgiven no one who wears a star.
- **Confession (page 2):** an order for **poison salts for the Whisper Wash wells**, signed by a Company agent.
- **Epilogue:** she leads the pack out of the wash to the safe land beyond Lantern Rock. As a hero: *Fast As A
  Snake* (fast, but fragile).
- **Ride-in line (in the game):** “They poisoned this wash. I will not let you finish the job.”

### 3. Deacon Graves: "The Preacher Gun" (Hollow Hill Chapel)
- **Who:** a gaunt, pale preacher in black with a purple sash and a small black Bible on his belt, who fires
  triple shots from the bell tower.
- **Wants:** to finish judging those who burned his church. He believes the Company set the blaze at Cinder
  Creek, and is the first to say so out loud.
- **Home ground and bio (in the game):** Hollow Hill Chapel. Lost his church and his flock. He holds the bell tower at Hollow Hill and judges every rider who climbs it.
- **Confession (page 3):** the Company bought his chapel's mortgage the week before the fire, and the deed is
  stamped with **the Cinder Creek water claim**: the first thread that ties the fire to the Company's ledger.
- **Epilogue:** he holds a service for the jail's guests, which none of them can leave. As a hero: *Holy Trinity*.
- **Ride-in line (in the game):** “Someone bought this hill before it burned. Pray it was not you.”

### 4. The Calloways: "Brothers By The Dozen" (Twin Forks)
- **Who:** a rowdy family of young brothers: freckles, ginger hair, striped ponchos, blue bandanas. They throw
  dynamite (the Dynamiter enemy) because their father's sticks are the only thing on the farm that isn't mortgaged.
- **Wants:** to keep the family farm. The Company holds their mortgage and keeps raising the rate.
- **Home ground and bio (in the game):** Twin Forks. A family of brothers holding Twin Forks against a loan that can never be repaid. They do not fight for money.
- **Confession (page 4):** the Company's **loan agreement**, with a clause hidden in the small print that makes
  any late payment the Company's right to seize the land. They robbed the bank because the bank was the Company.
- **Epilogue:** they rebuild the fences outside Lantern Rock and stay on to farm. As a hero: *Thick
  Skinned* (tough, slow).
- **Ride-in line (in the game):** “We lost the farm to a paper. We will keep it with powder.”

### 5. Iron Jack Harlan: "Bulletproof, They Say" (Slagtown)
- **Who:** a huge, scarred, bearded man in riveted iron plate, tank-like, who charges. His guards, the Brutes,
  wear the same iron.
- **Wants:** to take the armour off. The Company made it as an *experiment*, riveted it on him for a "test",
  and never came back with the key. Everyone thinks he is bulletproof. He is just stuck.
- **Home ground and bio (in the game):** Slagtown. Riveted into Company armour at the Slagtown foundry and left there. The world calls him bulletproof. He is only trapped.
- **Confession (page 5):** a **foundry work order** for "one suit of proof armour, one man, do not remove".
  **Ezra Stone**, who knows metal, is the one who spots the hidden bolt on the back.
- **Epilogue:** Ezra opens the armour; Jack asks if the smithy has work for a man his size. As a hero:
  *Iron Hide* (very tough, very slow).
- **Ride-in line (in the game):** “They bolted this iron on me. Break it, if you can.”

### 6. Mad Mesa Morgan: "Queen Of The Badlands" (Redstone Mesa)
- **Who:** a wild bandit queen with curly hair, a magenta hat and red feather, crossed bandoliers of dynamite
  sticks. Rides with wild riders. Grins a lot.
- **Wants:** to stop the railroad's blasting through the mesa. She was a quarry foreman; the Company
  dynamited a tunnel through the mesa's water source and called it progress.
- **Home ground and bio (in the game):** Redstone Mesa. A quarry foreman who watched the Company blast through the spring at Redstone Mesa. She kept the dynamite.
- **Confession (page 6):** a **blasting permit** signed against the mesa's spring. She takes the marshal across the
  rope bridge and shows him the dry channel.
- **Epilogue:** she leads the Lantern Rock volunteer fire crew (dynamite for controlled burns). As a hero:
  *Big Bang* (huge bullets, short range).
- **Ride-in line (in the game):** “They blasted my mesa dry. I will show you how they did it.”

### 7. Silas Vane: "Six-Gun Silas" (Vane's Crossing)
- **Who:** a cold, elegant gunfighter in royal blue with a thin moustache, two ivory-handled revolvers, silver
  spurs. Fans the hammer for six fast shots. His men, the Duelists, carry sawn-off shotguns.
- **Wants:** one last worthy duel. He has never been beaten, and it has emptied his life: the town around his
  crossing has died because nobody will cross it.
- **Home ground and bio (in the game):** Vane's Crossing. Paid by the Company to keep Vane's Crossing closed, so the only road west is the railroad. Never beaten, and it shows.
- **Confession (page 7):** the Company paid him a **standing fee to keep the Crossing closed**, so no wagon
  trains could use it, so the only route was the Company's railroad.
- **Epilogue:** after he loses to the marshal, the Crossing reopens and he opens a small shooting gallery on
  Lantern Rock's main street. As a hero: *Fan The Hammer* (fast, reload pause).
- **Ride-in line (in the game):** “I have never lost a duel, Marshal. It has cost me everything else.”

### 8. El Espectro: "The Ghost Of Red West" (Tres Ríos)
- **Who:** a ghostly figure in a white sombrero and a long white coat, pale bluish skin, glowing eyes and a
  purple bandana. Vanishes and reappears; his riders (the Ghost enemies) fade in and out.
- **The truth:** not a ghost at all. **Don Rafael Ibarra**, the last owner of the Tres Ríos land grant, the
  oldest ranch in the territory. When the Company seized the estate with forged papers, he staged his own
  death and let the legend of a ghost keep the Company's men away. His "riders" are the ranch hands, families
  and neighbours who have nowhere else to go.
- **Wants:** his land, and his people safe.
- **Home ground and bio (in the game):** Tres Rios. A ghost story told across Red West. The people of Tres Rios know a man lives behind it, and what he lost.
- **Confession (page 8):** the **real land grant**, plus a Company letter admitting the forgery. Here, and only
  here, he tells Flint what he saw the night Cinder Creek burned: the Company's own men, carrying lamps.
- **Big turn of the story:** this is the moment Flint learns the Company started the fire, and that *the outlaws
  he has been jailing were never the problem*.
- **Epilogue:** he doesn't take a cell; he takes the jail's front-porch chair. Flint restores his name in the
  town records. As a hero: *Ghost Step* (a moment of invisibility after each dash).
- **Ride-in line (in the game):** “They say I died. Let the dead teach you something.”

### 9. Lucky Lou: "The Riverboat Card Sharp" (The Silver Belle)
- **Who:** a smug riverboat gambler in a red waistcoat with a bowler hat and a card tucked in the band. Deals
  razor-edged cards in a fan. Her crew, the Knife Throwers, are her deck hands.
- **Wants:** to keep winning. She launders the Company's money through her tables, and she knows exactly how much
  it is.
- **Home ground and bio (in the game):** The Silver Belle. Runs the Silver Belle, where the Company's money goes in dirty and comes out clean. She knows every name on its payroll.
- **Confession (page 9):** the Company's **casino ledger**, the proof of every payment to every outlaw before her.
  She will trade it, but only for a game: win the duel, and the ledger is yours.
- **Epilogue:** she deals cards at the Lantern Rock saloon, and the table is honest. As a hero:
  *Stacked Deck* (fast fire, short range).
- **Ride-in line (in the game):** “Every payment the Company made is in my books. Win them.”

### 10. Colonel Crane: "The Gatling Colonel" (Fort Pell)
- **Who:** a stern, grey-haired colonel with a monocle, mutton-chop sideburns and a faded cavalry coat. Sweeps
  the field with a gatling gun, then must let it cool. His Troopers are his old regiment.
- **The link to Flint:** the man who raised him. Crane refused the same order Flint did, years ago, and was
  discharged in disgrace. The Company then bought his fort's debts and his loyalty, and gave him back the
  regiment he had been robbed of, on the condition that he serve them.
- **Wants:** his regiment back, and to believe he did right. He tells himself the Company is the law now.
- **Home ground and bio (in the game):** Fort Pell. The renegade colonel of Fort Pell. He raised the marshal, then chose the Company. His gatling has not lost a field.
- **Confession (page 10):** the **original order** to clear the valley, signed by the Company's president,
  **Ambrose Thorne**, and stamped with the same eight-point compass seal as every other page. Below it, a line
  in the Company's staff list: *W. Reed, guide, retained.* Flint's father is alive, and the Colonel has known for
  years. He promised Wick he would keep Flint out of it.
- **Finale:** Crane is beaten, not killed. Flint brings him in, without cuffs, and asks him to testify. He does,
  and tells Flint where the survey camp is that his father guides for.
- **Epilogue (chapter one ends here):** the pages go to the territorial court and Thorne is arrested. But every
  page carries the same compass seal, and Thorne says one thing before he is taken: he was never the one giving
  the orders. A last poster is pinned to the sheriff's wall: an unnamed face and a compass rose. The Wanted Road
  is not finished.
- **As a hero:** *Gatling Drill* (a triple shot every third shot, but slow).
- **Ride-in line (in the game):** “I taught you to read a trail, Flint. I never taught you when to turn back.”

## 6. The town's cast and how it grows

Lantern Rock's buildings (`src/town.js`) each get a voice, so the town itself tells the story between runs.

| Building | Person | Role in the story |
|---|---|---|
| Sheriff's Office | **Deputy June Holloway** | Posts the daily jobs, reads new rumours from the Road, keeps the case board of ledger pages |
| Gunsmith | **Ezra Stone** | Sells guns, knows metal, unlocks Iron Jack's story |
| Jail | the beaten outlaws | Each one sits in it, chats through the bars, pays a bounty per hour (the rule that exists today) |
| Bank | **Mr. Ollie Pruitt** | Careful and honest, the only banker in the territory who will not take the Company's money |
| Stable / Undertaker | **Old Gil** / **Mr. Grimsby** | The town's ears: rumours about who is coming, and who is not coming back |
| Saloon (Pass) | run by Dusty Pete once he is jailed and released | The place for the season-pass storyline |

**How the town changes with progress:** every beaten outlaw adds something visible. Pete's piano, Rosa's wolf
pups on the porch, the Deacon's small chapel, the Calloways' fences, Jack at the smithy, Morgan's fire crew,
Silas's gallery, Espectro in the chair, Lou's card table. A player who has finished the Road has a town full of
the people who once tried to kill them, which is the story's point.

## 7. How the story reaches the player (cheapest first)

Nothing here needs new game modes. Each item is a piece of text or a picture on a screen that already exists.

1. **Ride-in banner** (**done**): the outlaw's name, their own line (`taunt`), then the tip.
2. **Bounty Book** (**done**): each unlocked outlaw shows their home ground and a short bio (`home`, `bio`). The
   Wanted poster itself is unchanged; it is small, and adding text there would crowd the picture.
3. **Three story cards per outlaw** (new, one screen): a picture and 2 to 3 lines, unlocked by the three stars.
   These are the confession and epilogue beats above.
4. **The Case File** (new): ten empty ledger-page slots on the Bounty Book screen, filled as pages are earned.
   Reading all ten unlocks the finale.
5. **Town barks** (new, one line each): the people in section 6 comment on your progress when you open a building.
6. **An opening and an ending** (new, 4 to 6 comic panels each): Flint arriving by train at the Lantern Rock
   depot, and the final court scene. Made with the same picture tools as the characters (`tools/character-picture.mjs`).
7. **Voice** (exists): the outlaw taunts in `src/audioManifest.js` can be re-recorded to match the new lines.
8. **Environmental story** (with the world and props work, `POLISH_PLAN.md`): each stage's props carry its story
   (Pete's broken piano, the dry channel at Redstone Mesa, the stopped clock at Vane's Crossing).

## 8. What this asks of the game and of the plan

- **Data:** each entry in `src/outlaws.js` now has `home` (the place name), `taunt` and `bio`. Still to add: the
  look of the home ground (`sky`, `fog`, `sun`, palette, prop kit), `defeat`, `cards[3]` and `page`. A small
  `src/story.js` would hold the opening, ending and town barks.
- **UI:** a story-card screen, a Case File panel in the Bounty Book, and a one-line bark in each town building.
- **World work:** the per-stage atmosphere and props in `POLISH_PLAN.md` become each outlaw's *home ground*, so the
  world work and the story work are the same work.
- **Writing volume:** about 4 lines per outlaw for the first pass, and about 200 to 300 words per outlaw for the
  full pass. Ten outlaws, a hero, and a handful of townsfolk: about 4,000 words in all.
- **Fixed while doing the first pass:** `index.html` and the README still said "eight outlaws"; they now say ten (and
  the road button text no longer hard-codes a count).

**Built 2026-09-29 (story cards and the Case File).** `src/story.js` holds three cards and one ledger page per outlaw
and the chapter-one ending, written from sections 5 and 4b in the serious voice. In the Bounty Book, each unlocked outlaw
has a STORY n / 3 button that opens a card overlay (back, next, close; a locked card names the star that opens it), and a
**Case File** shows the ten ledger pages (a page comes with the second star) and the ending once all ten are held. The
result screen names a new card when a run earns a star. `tests/story.test.js` checks the cards, lengths and that nothing
graphic appears; `npm run test:story` drives the screens. Not built: opening and ending comic panels, town barks, the home
grounds' story props, re-recorded voice lines, an acknowledgement when a beaten outlaw is played as a hero.

## 9. Suggested order

1. **First pass (small): done for the ride-in line, the home ground and the bio** (2026-09-29). Not done: the
   opening and ending text.
2. **Story cards and the Case File** (medium): **done** (2026-09-29), see above.
3. **Home grounds** (with the world and props work): sky, fog, sun and tint per stage **done**; story props per stage still open.
4. **Town barks and visible changes** (medium): each beaten outlaw appears in Lantern Rock.
5. **Comics and voice** (medium): the opening and ending panels, and re-recorded taunts.

## 10. Decisions (owner's answers, 2026-09-29) and what is still open

| Question | Answer | What it changed |
|---|---|---|
| Tone | **Serious voice** | Every line in the game and here was rewritten plain and weighty; the comic touches in the town cast were removed. |
| Length | **Ten stages now, more later, so open-ended** | Section 4b: story in chapters, with new stages added at the end. |
| Flint's father, Wick | **Alive** | The Company kept him as a guide; the last ledger page lists him; Crane has known for years. |
| The Company's boss | **A front for someone bigger** | The Compass Board, named only at the end of chapter one; the compass seal is on every page. |
| El Espectro | **Approved** | Kept as written, with the respect rule in section 1. |
| The Drifter | **A legend, an immortal man** | See below; the shop blurb says it, and chapter two can use it. |

**The Drifter (decided 2026-09-30 by the owner): a legend, an immortal man.** In the shop the Drifter is the plain,
colour-your-own cowboy. He is the legend of the Wanted Road: a rider who has walked it in every age, and whom people
say cannot die. He needs no backstory of his own, so any player can dress him as themselves, and the story cards still
tell the story in the marshal's voice. Rules for using him, so the story never contradicts itself: he is never shown
fighting or dying (the game has an under-13 mode, and immortal means the question never comes up); the Marshal's
story stands as written (Flint is the hero of chapter one, the Drifter is a rumour on the road that Flint hears,
never a rival for the star); and his link to the Compass Board (a friend, a former member, the thing they fear) is left
open for chapter two. Only the shop blurb says it so far.

**Still open:**
1. **Who is on the Compass Board?** One face, or a name only? Leave it unwritten until chapter two is planned.
2. **What does the game call the story?** For example: "Red West: The Wanted Road, Chapter One: The Ledger".
3. **Playable heroes:** when a player uses an unlocked outlaw, should the ride-in banner or a story card acknowledge
   it (for example Pete meeting his own poster)? Not needed for chapter one.
4. **Names:** all places and people are invented. They still need a trademark check before release.

## Sources

- [Seven Western plots](https://tvtropes.org/pmwiki/pmwiki.php/Main/TheSevenWesternPlots) (Frank Gruber's list: the
  revenge, marshal, outlaw and empire stories this plot combines)
- [History of the Western genre and story structure](https://charlie45.substack.com/p/history-of-the-western-genre-how)
- [The Western genre in film and TV](https://nofilmschool.com/western-genre)
- [Roguelikes and narrative design with Hades creative director Greg Kasavin](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
  (story delivered in short pieces after every run; the model for the story cards and town barks)
- [How Hades redefines roguelike storytelling](https://screenrant.com/hades-roguelike-supergiant-storytelling-accessible/)
- [Environmental storytelling in games](https://gamedesignskills.com/game-design/environmental-storytelling/)
- [How Studio MDHR builds a Cuphead boss](https://gameinformer.com/feature/2022/12/27/how-studio-mdhr-builds-a-cuphead-boss)
  (one boss, one theme, one strong silhouette)
