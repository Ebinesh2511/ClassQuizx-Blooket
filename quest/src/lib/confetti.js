import confetti from 'canvas-confetti';

const colors = ['#ffc531', '#ff5468', '#3d9bff', '#2fce71', '#b06cff', '#ffffff'];

export function burst(opts = {}) {
	confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.65 }, colors, disableForReducedMotion: true, ...opts });
}

export function coins(x = 0.5, y = 0.5) {
	confetti({ particleCount: 40, spread: 360, startVelocity: 25, gravity: 0.9, ticks: 120, scalar: 1.2, shapes: ['circle'], colors: ['#ffc531', '#ffdd70', '#e0a800'], origin: { x, y }, disableForReducedMotion: true });
}

export function celebrate(ms = 2500) {
	const end = Date.now() + ms;
	(function frame() {
		confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true });
		confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true });
		if (Date.now() < end) requestAnimationFrame(frame);
	})();
}
