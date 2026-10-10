// How each Gold Quest chest reward looks on screen.
export function rewardInfo(r) {
	if (!r) return { icon: '❔', title: '???', color: '#ccc', tone: 'neutral' };
	switch (r.type) {
		case 'gold':
			return { icon: r.amount >= 75 ? '💰' : '🪙', title: `+${r.amount} Gold`, color: '#ffc531', tone: 'good' };
		case 'mult':
			return { icon: r.factor === 3 ? '🤑' : '✖️', title: r.factor === 3 ? 'Triple Gold!' : 'Double Gold!', color: '#2fce71', tone: 'good' };
		case 'take':
			return { icon: '🫳', title: `Take ${r.pct}%`, color: '#3d9bff', tone: 'good' };
		case 'swap':
			return { icon: '🔄', title: 'SWAP!', color: '#b06cff', tone: 'good' };
		case 'lose':
			return { icon: '🐉', title: `Lose ${r.pct}%`, color: '#ff5468', tone: 'bad' };
		case 'dragon':
			return { icon: '🏆', title: "Dragon's Treasure!", color: '#ff9d3c', tone: 'good' };
		default:
			return { icon: '🕸️', title: 'Nothing...', color: '#a6a0bf', tone: 'neutral' };
	}
}

/** One-line description for the host feed. */
export function feedText(e, name) {
	const a = name(e.actor);
	const t = e.target ? name(e.target) : '';
	switch (e.kind) {
		case 'join':
			return { icon: '👋', text: `${a} joined the quest` };
		case 'gold':
			return { icon: '🪙', text: `${a} found ${e.amount} gold` };
		case 'mult':
			return { icon: e.factor === 3 ? '🤑' : '✖️', text: `${a} ${e.factor === 3 ? 'TRIPLED' : 'doubled'} their gold!` };
		case 'take':
			return e.amount ? { icon: '🫳', text: `${a} took ${e.amount} gold from ${t}` } : { icon: '🫳', text: `${a} tried to rob ${t}… but they're broke!` };
		case 'swap':
			return { icon: '🔄', text: `${a} swapped gold with ${t}!` };
		case 'lose':
			return e.amount ? { icon: '🐉', text: `A dragon snatched ${e.amount} gold from ${a}` } : { icon: '🐉', text: `A dragon checked ${a}'s pockets. Empty!` };
		case 'dragon':
			return { icon: '🏆', text: `${a} claimed the Dragon's Treasure: ${e.amount} gold!` };
		case 'nothing':
			return { icon: '🕸️', text: `${a} opened an empty chest` };
		default:
			return { icon: '✨', text: `${a} did something` };
	}
}

/** Feed shown on the host screen: newest first (top-down), joins only in the lobby. */
export function liveFeed(feed = [], status = 'playing', limit = 12) {
	return feed
		.filter((e) => e.kind !== 'join' || status === 'lobby')
		.slice(-limit)
		.reverse();
}
