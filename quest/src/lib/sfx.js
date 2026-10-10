// Tiny WebAudio synth so the app has sound without shipping audio files.
let ctx;
let muted = (() => {
	try {
		return localStorage.getItem('qq-muted') === '1';
	} catch {
		return false;
	}
})();

export const isMuted = () => muted;
export function setMuted(v) {
	muted = v;
	try {
		localStorage.setItem('qq-muted', v ? '1' : '0');
	} catch {}
}

function ac() {
	if (!ctx) {
		const C = window.AudioContext || window.webkitAudioContext;
		if (!C) return null;
		ctx = new C();
	}
	if (ctx.state === 'suspended') ctx.resume();
	return ctx;
}

function tone(freq, { at = 0, dur = 0.12, type = 'sine', vol = 0.18, slide = 0 } = {}) {
	if (muted) return;
	const a = ac();
	if (!a) return;
	const t = a.currentTime + at;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = type;
	o.frequency.setValueAtTime(freq, t);
	if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g).connect(a.destination);
	o.start(t);
	o.stop(t + dur + 0.05);
}

export const sfx = {
	click: () => tone(520, { dur: 0.06, type: 'triangle', vol: 0.12 }),
	pop: () => tone(300, { dur: 0.12, slide: 500, type: 'sine', vol: 0.16 }),
	join: () => [660, 880].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.1, type: 'triangle' })),
	correct: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.14, type: 'triangle' })),
	wrong: () => [330, 220].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.2, type: 'sawtooth', vol: 0.08 })),
	coin: () => [988, 1319].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.12, type: 'square', vol: 0.06 })),
	chest: () => tone(180, { dur: 0.25, slide: 400, type: 'triangle', vol: 0.2 }),
	bad: () => tone(400, { dur: 0.5, slide: -300, type: 'sawtooth', vol: 0.08 }),
	tick: () => tone(1200, { dur: 0.03, type: 'square', vol: 0.04 }),
	fanfare: () => [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.18, type: 'triangle', vol: 0.15 }))
};
