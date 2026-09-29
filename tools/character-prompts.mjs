// Front-view picture prompts for AI-made characters (tools/character-picture.mjs), one shared style
// so every character looks like part of the same game. The picture then goes to tools/meshy.mjs.

export const STYLE = 'Full-body character design for a 3D mobile game, front view, T-pose (arms straight out to the sides, legs slightly apart), plain white background, no shadows. Stylized low-poly, chunky toy-like proportions (big head, broad torso, short sturdy legs), like a Brawl Stars character. Flat bold colors, simple shapes, very few details. Weapons holstered, hands open and empty. Full body visible from hat to boots, centered, facing the camera. Rendered as a 3D game character model, like a Brawl Stars 3D render: soft studio lighting and gentle shading that shows the volume of each shape, smooth plastic toy-like materials (this helps image-to-3D tools read the depth).';

export const CHARACTERS = {
    // The player.
    'marshal': 'Marshal Flint Reed, the heroic lawman and player hero. Confident, determined face with a thick dark handlebar moustache and stubble. Wide-brim brown cowboy hat with a gold sheriff star badge on the front. Long orange-brown leather duster coat over a white shirt, red bandana around his neck, brown belt with a big gold buckle. Blue denim jeans, brown boots with spurs. A revolver in a holster on his hip.',
    'dusty-pete': 'Dusty Pete, a burly, scruffy saloon-brawler outlaw. Unshaven stubbly face with a bushy brown beard and a crooked grin. Battered, dented brown cowboy hat. Brown leather vest over a torn off-white shirt with rolled-up sleeves, thick forearms, big fists. Red bandana tied around his neck. Worn brown trousers held up with suspenders, scuffed brown boots. A revolver in a holster on his hip.',
    'rattlesnake-rosa': 'Rattlesnake Rosa, a fierce female outlaw who runs with a wolf pack. Sharp confident face, long dark braid over one shoulder. Dark green flat-brim hat with a snake-skin band. Green duster coat with a grey wolf-fur mantle over the shoulders. Bright yellow bandana around her neck. Dark trousers, tall snake-skin boots. A revolver in a holster on her hip and a wolf-fang necklace.',
    'deacon-graves': 'Deacon Graves, a gaunt, sinister gunslinging preacher. Pale, bony face with sunken eyes and a thin grey goatee. Tall black flat-crowned preacher hat. Long black frock coat with a white clerical collar and a deep purple sash across the chest. Black trousers and polished black boots. A small black bible hanging from his belt and a long-barreled revolver in a holster.',
    'calloways': 'A Calloway brother, a rowdy young outlaw from a big gang of brothers. Freckled cheeky face with messy ginger hair poking out. Tan cowboy hat. Brown short jacket under an orange-red striped poncho. Blue bandana pulled up over his nose and mouth. Brown trousers, simple boots. A revolver in a holster on his hip.',
    'iron-jack': 'Iron Jack Harlan, a huge armored outlaw said to be bulletproof. Scarred face, thick dark beard, stern eyes. Grey cowboy hat. Riveted grey iron chest plate and heavy iron shoulder guards over a dark slate-blue coat. Orange bandana around his neck. Dark trousers and heavy black boots. Very broad, heavy, tank-like build. A big revolver in a holster on his hip.',
    'mesa-morgan': 'Mad Mesa Morgan, a wild female bandit queen of the badlands. Grinning, wild-eyed face with big untamed curly hair. Magenta cowboy hat with a red feather. Pink-red coat over a brown fringed poncho. Gold bandana around her neck. Two bullet bandoliers crossed over her chest. Brown trousers, tall boots. A revolver in a holster on each hip.',
    'silas-vane': 'Silas Vane, a cold, elegant, legendary gunfighter. Calm narrow-eyed face with a thin black moustache and slicked black hair. Dark navy-blue flat-brim hat. Royal blue long tailored coat with a black poncho over the shoulders. Blood-red bandana around his neck. Dark trousers and polished black boots with silver spurs. Two ivory-handled revolvers in holsters on both hips.',
    // Playable characters bought with Bounty Dollars (src/cosmetics.js).
    'june-holloway': 'Deputy June Holloway, a young, sharp-eyed frontier deputy and sharpshooter. Friendly, determined face with freckles and a short auburn bob under a light tan cowboy hat with a small silver deputy star pinned to the band. Teal-blue shirt with rolled sleeves under a short brown suede jacket, cream bandana. Brown belt, tan trousers, brown boots. A long-barreled revolver in a holster on her hip.',
    'ezra-stone': 'Ezra Stone, a big, kind-hearted town blacksmith turned gunhand. Broad bald head with a short grey beard and bushy eyebrows, warm smile, no hat. Rust-orange shirt with rolled sleeves, a heavy dark-brown leather blacksmith apron over it, thick leather gloves tucked in the belt. Charcoal trousers, heavy boots. Very broad, strong build. A revolver in a holster on his hip.',
    // Outlaws 9 and 10.
    'lucky-lou': 'Lucky Lou Deveraux, a smug riverboat card sharp outlaw woman. Sly smile, a beauty mark, dark hair in a tight bun under a small black bowler hat with a playing card tucked in the band. Deep red waistcoat over a white ruffled shirt, black string tie, long black coat with gold trim. Black trousers, polished boots. A small revolver in a holster on her hip and a deck of cards on her belt.',
    'colonel-crane': 'Colonel August Crane, a stern, grey-haired renegade cavalry colonel. Hard face with big grey mutton-chop sideburns and a monocle. Dark slate-grey cavalry hat with a yellow cord. Faded grey officer coat with brass buttons and yellow shoulder boards, a yellow sash at the waist. Grey trousers with a yellow side stripe, tall black riding boots. A revolver in a holster on his hip.',
    'el-espectro':'El Espectro, a ghostly legendary outlaw, the phantom of the West. Pale bluish-white skin, glowing pale-blue eyes, purple bandana covering the lower face. Wide white sombrero. Long white coat under a dark grey poncho, with ragged, wispy edges at the hems. Pale grey trousers and white boots. A revolver in a holster on his hip. An eerie, spectral but still toy-like look.'
};

// Animals (a test of whether Meshy can rig them; its auto-rig is made for humanoids).
export const ANIMALS = {
    'wolf': 'Full-body design of a grey desert wolf for a 3D mobile game, side view, standing on all four legs, plain white background, no shadows. Stylized low-poly, chunky toy-like proportions, flat bold colors, like a Brawl Stars 3D render with soft studio lighting.'
};

export function promptFor(name, extra = '') {
    if(ANIMALS[name]) return ANIMALS[name];
    const description = CHARACTERS[name];
    if(!description) throw new Error(`No prompt for "${name}". Known: ${Object.keys(CHARACTERS).join(', ')}`);
    return `${STYLE}\n\nCharacter: ${description}${extra ? `\n\n${extra}` : ''}`;
}
