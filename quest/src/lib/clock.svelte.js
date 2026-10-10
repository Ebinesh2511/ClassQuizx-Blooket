import { now } from './socket.js';

// a shared reactive clock, ticking 4x per second
export const clock = $state({ now: now() });
setInterval(() => (clock.now = now()), 250);

export function fmt(ms) {
	const s = Math.max(0, Math.ceil(ms / 1000));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
