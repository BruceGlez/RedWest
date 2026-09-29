# Red West story bible

Written 2026-09-29. A **proposal for the owner to approve or change**: nothing here is in the game yet, and every
name, place and plot point can be swapped. It is built on what already exists in the code (the ten outlaws in
`src/outlaws.js`, their picture prompts in `tools/character-prompts.mjs`, the enemy roster in `src/enemyTypes.js`,
the Frontier Town buildings in `src/town.js`, the perks in `src/perks.js`), so the story fits the game as it plays.
Research sources are at the end.

## 1. The rules for the writing

- **Tone: a Saturday-morning Western.** Big personalities, dry humour, real stakes, no gore. The art is chunky and
  toy-like, and the game has an under-13 mode (`src/privacy.js`), so the story stays fit for everyone: fights are
  stylised, nobody is shown dying, loss is told, not shown.
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
ledger are in his hands, and the last outlaw is the man who taught him to ride.

## 4. The hero: Marshal Flint Reed

**Who he is.** A lawman in a wide brown hat with a gold star, a handlebar moustache, an orange duster, a red
bandana and one revolver (the marshal picture prompt in `tools/character-prompts.mjs`). Confident, dry, patient,
and slightly too proud of his aim.

**Where he comes from.**
- Born Flint Reed in **Cinder Creek**, a small ranching and mining settlement at the far edge of the territory.
  His father, **Wick Reed**, was a wagon-master; his mother, **Ada**, taught the settlement's children to read.
- When Flint was fourteen, a fire swept Cinder Creek in the middle of the night. The Company's report called it
  a bandit raid. The settlement was gone by morning and the water rights to its creek changed hands the next
  week. Wick, out on the trail with a wagon train, never came back. **What happened to him is left open** so the
  finale, or a sequel, can pay it off (see the open questions).
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
**His voice.** Short, warm, understated. "Evening, Pete." "I don't shoot people who ask nicely. You didn't."

**His people (all already in the game):**
- **Deputy June Holloway** (a hired hand, `src/perks.js`): a young sharpshooter with an auburn bob and a silver
  star. Runs the Sheriff's Office in Lantern Rock and posts the daily jobs. Cheerful, sharp, keeps a tally of
  everything Flint breaks. She joins him from the start.
- **Ezra Stone** (a hired hand): the town blacksmith, big and gentle, turned gunsmith. Runs the gunsmith's shop.
  Knows metal, which matters at Iron Jack's foundry.
- **The jail's guests:** every outlaw Flint beats.

## 5. The ten outlaws and their worlds

Each stage is a place with its own light, sound and props, an enemy that belongs to it, and three story beats
that unlock with the three stars (`STAR_GOALS` in `src/outlaws.js`):

- **Star 1, "Defeat the outlaw":** their *Wanted card*: who they are and what the world says about them.
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
- **Wanted card:** "Breaks chairs for a living. Has never once paid for one."
- **Confession (page 1):** the Company gave him a small payment for every claim he "convinced" to sell. Page one
  is a receipt: *For rough work, $50.* He hadn't noticed it was the same rate as a fence post.
- **Epilogue:** he takes the jail's work sentence, mends the town's benches, and becomes Lantern Rock's bouncer.
  As a hero: *Barroom Brawler* (long dashes).
- **Line:** "Marshal! You come to hit me or drink with me? Either way, sidestep."

### 2. Rattlesnake Rosa: "Runs With Wolves" (Whisper Wash)
- **Who:** a fierce outlaw with a long braid, a green coat and a grey wolf-fur mantle, a wolf-fang necklace on her
  neck. Calls the wolves with a howl. Her "pets" are rattlers (the Rattler enemy).
- **Wants:** the wolves and the wash to be left alone. The Company poisoned the last clean waterhole to force
  homesteaders out, and the wolves came down from the hills looking for water, so she raised the pups.
- **Wanted card:** "Not a wolf herself, but they'll do what she asks."
- **Confession (page 2):** an order for **poison salts for the Whisper Wash wells**, signed by a Company agent.
- **Epilogue:** she leads the pack out of the wash to the safe land beyond Lantern Rock. As a hero: *Fast As A
  Snake* (fast, but fragile).
- **Line:** "You smell like the Company. You smell like their ink."

### 3. Deacon Graves: "The Preacher Gun" (Hollow Hill Chapel)
- **Who:** a gaunt, pale preacher in black with a purple sash and a small black Bible on his belt, who fires
  triple shots from the bell tower.
- **Wants:** to finish judging those who burned his church. He believes the Company set the blaze at Cinder
  Creek, and is the first to say so out loud.
- **Wanted card:** "Preaches on Sundays. Shoots on the other six days."
- **Confession (page 3):** the Company bought his chapel's mortgage the week before the fire, and the deed is
  stamped with **the Cinder Creek water claim**: the first thread that ties the fire to the Company's ledger.
- **Epilogue:** he holds a service for the jail's guests, which none of them can leave. As a hero: *Holy Trinity*.
- **Line:** "I do not seek vengeance, Marshal. I seek an audience. Kneel, or dodge."

### 4. The Calloways: "Brothers By The Dozen" (Twin Forks)
- **Who:** a rowdy family of young brothers: freckles, ginger hair, striped ponchos, blue bandanas. They throw
  dynamite (the Dynamiter enemy) because their father's sticks are the only thing on the farm that isn't mortgaged.
- **Wants:** to keep the family farm. The Company holds their mortgage and keeps raising the rate.
- **Wanted card:** "Four brothers. One horse. Three opinions."
- **Confession (page 4):** the Company's **loan agreement**, with a clause hidden in the small print that makes
  any late payment the Company's right to seize the land. They robbed the bank because the bank was the Company.
- **Epilogue:** they repair the fences outside Lantern Rock, badly, and argue about it. As a hero: *Thick
  Skinned* (tough, slow).
- **Line:** "You can't arrest a whole family, Marshal." "I'll start with the loudest one."

### 5. Iron Jack Harlan: "Bulletproof, They Say" (Slagtown)
- **Who:** a huge, scarred, bearded man in riveted iron plate, tank-like, who charges. His guards, the Brutes,
  wear the same iron.
- **Wants:** to take the armour off. The Company made it as an *experiment*, riveted it on him for a "test",
  and never came back with the key. Everyone thinks he is bulletproof. He is just stuck.
- **Wanted card:** "Bullets bounce off him. So, apparently, do questions."
- **Confession (page 5):** a **foundry work order** for "one suit of proof armour, one man, do not remove".
  **Ezra Stone**, who knows metal, is the one who spots the hidden bolt on the back.
- **Epilogue:** Ezra opens the armour; Jack cries a little; then he asks if the smithy has a job. As a hero:
  *Iron Hide* (very tough, very slow).
- **Line:** "Shoot me from the front, I'll thank you. Shoot me from behind and I'll finally feel something."

### 6. Mad Mesa Morgan: "Queen Of The Badlands" (Redstone Mesa)
- **Who:** a wild bandit queen with curly hair, a magenta hat and red feather, crossed bandoliers of dynamite
  sticks. Rides with wild riders. Grins a lot.
- **Wants:** to stop the railroad's blasting through the mesa. She was a quarry foreman; the Company
  dynamited a tunnel through the mesa's water source and called it progress.
- **Wanted card:** "Never met a fuse she didn't like."
- **Confession (page 6):** a **blasting permit** signed against the mesa's spring. She takes the marshal along the
  rope bridge and shows him the dry channel.
- **Epilogue:** she leads the Lantern Rock volunteer fire crew (dynamite for controlled burns). As a hero:
  *Big Bang* (huge bullets, short range).
- **Line:** "You climbed all the way up here? Cute. Let's see you climb back down."

### 7. Silas Vane: "Six-Gun Silas" (Vane's Crossing)
- **Who:** a cold, elegant gunfighter in royal blue with a thin moustache, two ivory-handled revolvers, silver
  spurs. Fans the hammer for six fast shots. His men, the Duelists, carry sawn-off shotguns.
- **Wants:** one last worthy duel. He has never been beaten, and it has emptied his life: the town around his
  crossing has died because nobody will cross it.
- **Wanted card:** "Never lost a duel. Never won a game of solitaire either."
- **Confession (page 7):** the Company paid him a **standing fee to keep the Crossing closed**, so no wagon
  trains could use it, so the only route was the Company's railroad.
- **Epilogue:** after he loses to the marshal, the Crossing reopens and he opens a small shooting gallery on
  Lantern Rock's main street. As a hero: *Fan The Hammer* (fast, reload pause).
- **Line:** "Twelve paces, Marshal? I'd rather five. Let's talk in gunsmoke."

### 8. El Espectro: "The Ghost Of Red West" (Tres Ríos)
- **Who:** a ghostly figure in a white sombrero and a long white coat, pale bluish skin, glowing eyes and a
  purple bandana. Vanishes and reappears; his riders (the Ghost enemies) fade in and out.
- **The truth:** not a ghost at all. **Don Rafael Ibarra**, the last owner of the Tres Ríos land grant, the
  oldest ranch in the territory. When the Company seized the estate with forged papers, he staged his own
  death and let the legend of a ghost keep the Company's men away. His "riders" are the ranch hands, families
  and neighbours who have nowhere else to go.
- **Wants:** his land, and his people safe.
- **Wanted card:** "Has been dead for six years. Has not been told."
- **Confession (page 8):** the **real land grant**, plus a Company letter admitting the forgery. Here, and only
  here, he tells Flint what he saw the night Cinder Creek burned: the Company's own men, carrying lamps.
- **Big turn of the story:** this is the moment Flint learns the Company started the fire, and that *the outlaws
  he has been jailing were never the problem*.
- **Epilogue:** he doesn't take a cell; he takes the jail's front-porch chair. Flint restores his name in the
  town records. As a hero: *Ghost Step* (a moment of invisibility after each dash).
- **Line:** "They call me a ghost, Marshal. Ghosts don't have anything left to lose."

### 9. Lucky Lou: "The Riverboat Card Sharp" (The Silver Belle)
- **Who:** a smug riverboat gambler in a red waistcoat with a bowler hat and a card tucked in the band. Deals
  razor-edged cards in a fan. Her crew, the Knife Throwers, are her deck hands.
- **Wants:** to keep winning. She launders the Company's money through her tables, and she knows exactly how much
  it is.
- **Wanted card:** "Has never lost a hand. Has never played one fair."
- **Confession (page 9):** the Company's **casino ledger**, the proof of every payment to every outlaw before her.
  She will trade it, but only for a game: win the duel, and the ledger is yours.
- **Epilogue:** she deals cards at the Lantern Rock saloon and keeps a very slightly honest table. As a hero:
  *Stacked Deck* (fast fire, short range).
- **Line:** "Fifty-fifty odds, Marshal. That's my favourite kind: I can always adjust them."

### 10. Colonel Crane: "The Gatling Colonel" (Fort Pell)
- **Who:** a stern, grey-haired colonel with a monocle, mutton-chop sideburns and a faded cavalry coat. Sweeps
  the field with a gatling gun, then must let it cool. His Troopers are his old regiment.
- **The link to Flint:** the man who raised him. Crane refused the same order Flint did, years ago, and was
  discharged in disgrace. The Company then bought his fort's debts and his loyalty, and gave him back the
  regiment he had been robbed of, on the condition that he serve them.
- **Wants:** his regiment back, and to believe he did right. He tells himself the Company is the law now.
- **Wanted card:** "Taught the marshal everything. Has stopped being proud of it."
- **Confession (page 10):** the **original order** to clear the valley, signed by the Company's president,
  **Ambrose Thorne**. With ten pages, the evidence is complete.
- **Finale:** Crane is beaten, not killed. Flint brings him in, without cuffs, and asks him to testify. He does.
- **Epilogue:** the pages go to the territorial court. Thorne's arrest is told in a short closing scene, and a last
  poster is pinned to the sheriff's wall: an unnamed face for a possible sequel.
- **As a hero:** *Gatling Drill* (a triple shot every third shot, but slow).
- **Line:** "You were the best scout I ever trained, Flint. That's the only reason you got this far."

## 6. The town's cast and how it grows

Lantern Rock's buildings (`src/town.js`) each get a voice, so the town itself tells the story between runs.

| Building | Person | Role in the story |
|---|---|---|
| Sheriff's Office | **Deputy June Holloway** | Posts the daily jobs, reads new rumours from the Road, keeps the case board of ledger pages |
| Gunsmith | **Ezra Stone** | Sells guns, knows metal, unlocks Iron Jack's story |
| Jail | the beaten outlaws | Each one sits in it, chats through the bars, pays a bounty per hour (the rule that exists today) |
| Bank | **Mr. Ollie Pruitt** | Nervous, honest, the only banker in the territory who won't take the Company's money |
| Stable / Undertaker | **Old Gil** / **Mr. Grimsby** | Comic relief, and rumours about who is coming to town |
| Saloon (Pass) | run by Dusty Pete once he is jailed and released | The place for the season-pass storyline |

**How the town changes with progress:** every beaten outlaw adds something visible. Pete's piano, Rosa's wolf
pups on the porch, the Deacon's small chapel, the Calloways' fences, Jack at the smithy, Morgan's fire crew,
Silas's gallery, Espectro in the chair, Lou's card table. A player who has finished the Road has a town full of
the people who once tried to kill them, which is the story's point.

## 7. How the story reaches the player (cheapest first)

Nothing here needs new game modes. Each item is a piece of text or a picture on a screen that already exists.

1. **Ride-in banner** (exists, shows a tip): add one line of dialogue, the outlaw's own words.
2. **Wanted poster and Bounty Book** (exist): add the "Wanted card" line and a short bio (2 to 3 sentences).
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

- **Data:** extend each entry in `src/outlaws.js` with `home` (name, sky, fog, sun, palette, prop kit), `bio`,
  `taunt`, `defeat`, `cards[3]` and `page`. A small `src/story.js` holds the opening, ending and town barks.
- **UI:** a story-card screen, a Case File panel in the Bounty Book, and a one-line bark in each town building.
- **World work:** the per-stage atmosphere and props in `POLISH_PLAN.md` become each outlaw's *home ground*, so the
  world work and the story work are the same work.
- **Writing volume:** about 4 lines per outlaw for the first pass, and about 200 to 300 words per outlaw for the
  full pass. Ten outlaws, a hero, and a handful of townsfolk: about 4,000 words in all.
- **A note found while reading the code:** `index.html` still says "STAGE 1 / 8" and "eight outlaws" while the
  game has ten. The road button may be updated in script, but the Wanted Road text should be checked.

## 9. Suggested order

1. **First pass (small):** one ride-in line, one poster line and a bio per outlaw; the opening and ending text.
2. **Story cards and the Case File** (medium): the three cards per outlaw and the ledger page collectible.
3. **Home grounds** (with the world and props work): sky, fog, sun and props per stage.
4. **Town barks and visible changes** (medium): each beaten outlaw appears in Lantern Rock.
5. **Comics and voice** (medium): the opening and ending panels, and re-recorded taunts.

## 10. Open questions for the owner

1. **Tone:** comedic like Brawl Stars, or more serious? This document leans light with real stakes.
2. **Flint's father, Wick:** alive (found in Fort Pell's cells, or at Tres Ríos) or gone for good?
3. **The Company's boss:** is Ambrose Thorne the final villain, or a front for someone bigger (a sequel)?
4. **The Drifter and custom heroes:** the shop's colourful cowboy is not Flint. Is the Drifter "you", a separate
   traveller, or Flint in disguise?
5. **Playable heroes and canon:** unlocked outlaws are playable in the shop. Should their story cards change if
   you play as them (for example, Pete jokes with June)?
6. **El Espectro:** are you comfortable with his story as written (a rancher who faked his death)? It is written
   with respect (see the "Respect" rule in section 1).
7. **Names:** all places and people here are invented. They still need a trademark check before release.

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
