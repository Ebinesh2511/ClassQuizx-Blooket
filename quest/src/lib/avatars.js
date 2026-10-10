// Funny animal avatars: an animal, a background colour and a silly accessory.

export const ANIMALS = [
	['🦊', 'Fox'], ['🐼', 'Panda'], ['🐸', 'Frog'], ['🦄', 'Unicorn'], ['🐙', 'Octopus'],
	['🦥', 'Sloth'], ['🐧', 'Penguin'], ['🦒', 'Giraffe'], ['🦛', 'Hippo'], ['🐨', 'Koala'],
	['🦉', 'Owl'], ['🐢', 'Turtle'], ['🦖', 'T-Rex'], ['🐷', 'Pig'], ['🐵', 'Monkey'],
	['🦦', 'Otter'], ['🐻', 'Bear'], ['🐯', 'Tiger'], ['🦁', 'Lion'], ['🐮', 'Cow'],
	['🐔', 'Chicken'], ['🦆', 'Duck'], ['🦩', 'Flamingo'], ['🦔', 'Hedgehog'], ['🐰', 'Bunny'],
	['🐹', 'Hamster'], ['🦝', 'Raccoon'], ['🐲', 'Dragon'], ['🦭', 'Seal'], ['🐳', 'Whale'],
	['🦀', 'Crab'], ['🐌', 'Snail'], ['🦘', 'Kangaroo'], ['🦙', 'Llama'], ['🐐', 'Goat'],
	['🦨', 'Skunk'], ['🐊', 'Croc'], ['🦓', 'Zebra'], ['🐝', 'Bee'], ['🦜', 'Parrot']
];

export const COLORS = [
	'#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7',
	'#748ffc', '#9775fa', '#da77f2', '#f783ac', '#20c997', '#fab005'
];

// '' = no accessory
export const HATS = ['', '🎩', '👑', '🧢', '🎓', '🕶️', '🎀', '⛑️', '🪖', '🎉', '🌸', '🍀'];

export const ADJECTIVES = [
	'Sneaky', 'Wobbly', 'Grumpy', 'Sparkly', 'Fluffy', 'Sleepy', 'Turbo', 'Dizzy', 'Cheeky',
	'Bouncy', 'Mighty', 'Sassy', 'Jolly', 'Clumsy', 'Fancy', 'Spicy', 'Zippy', 'Giggly',
	'Funky', 'Cosmic', 'Snazzy', 'Wiggly', 'Noodle', 'Crunchy', 'Soggy', 'Disco', 'Ninja'
];

const rnd = (n) => Math.floor(Math.random() * n);

export function randomAvatar() {
	return { animal: rnd(ANIMALS.length), color: rnd(COLORS.length), hat: rnd(HATS.length) };
}

export function randomName(avatar) {
	const a = avatar ?? randomAvatar();
	return `${ADJECTIVES[rnd(ADJECTIVES.length)]} ${ANIMALS[a.animal][1]}`;
}

export function sanitizeAvatar(a) {
	const clamp = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : rnd(n));
	return { animal: clamp(a?.animal, ANIMALS.length), color: clamp(a?.color, COLORS.length), hat: clamp(a?.hat, HATS.length) };
}
