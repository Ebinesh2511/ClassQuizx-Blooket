import { randomInt, randomUUID } from 'node:crypto';
import { sanitizeQuestions } from '../src/lib/csv.js';
import { sanitizeAvatar } from '../src/lib/avatars.js';

export const MAX_PLAYERS = 300;
const games = new Map();

export function getGame(pin) {
	return games.get(String(pin ?? '').trim());
}

function makePin() {
	let pin;
	do pin = String(randomInt(100000, 1000000));
	while (games.has(pin));
	return pin;
}

function shuffle(arr) {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = randomInt(0, i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// ---------- Gold Quest chest table ----------
// weights are relative; tweak to taste
const CHEST_TABLE = [
	[{ type: 'gold', amount: 10 }, 10],
	[{ type: 'gold', amount: 20 }, 10],
	[{ type: 'gold', amount: 30 }, 9],
	[{ type: 'gold', amount: 40 }, 8],
	[{ type: 'gold', amount: 50 }, 7],
	[{ type: 'gold', amount: 75 }, 5],
	[{ type: 'gold', amount: 100 }, 4],
	[{ type: 'mult', factor: 2 }, 6],
	[{ type: 'mult', factor: 3 }, 3],
	[{ type: 'take', pct: 10 }, 6],
	[{ type: 'take', pct: 25 }, 4],
	[{ type: 'swap' }, 4],
	[{ type: 'lose', pct: 10 }, 6],
	[{ type: 'lose', pct: 25 }, 4],
	[{ type: 'nothing' }, 7],
	[{ type: 'dragon' }, 2]
];
const CHEST_TOTAL = CHEST_TABLE.reduce((s, [, w]) => s + w, 0);

export function rollChest({ hasOthers = true, dragonPool = 0, rand = Math.random } = {}) {
	let r = rand() * CHEST_TOTAL;
	let pick = CHEST_TABLE[0][0];
	for (const [item, w] of CHEST_TABLE) {
		if ((r -= w) < 0) {
			pick = item;
			break;
		}
	}
	pick = { ...pick };
	// rewards that can't do anything get turned into plain gold
	if ((pick.type === 'take' || pick.type === 'swap') && !hasOthers) return { type: 'gold', amount: 25 };
	if (pick.type === 'dragon' && dragonPool <= 0) return { type: 'gold', amount: 50 };
	return pick;
}

// ---------- Game ----------
export class Game {
	constructor(io, { questions, mode, settings, title }) {
		this.io = io;
		this.pin = makePin();
		this.hostToken = randomUUID();
		this.title = String(title || 'Quiz').slice(0, 80);
		this.mode = mode === 'classic' ? 'classic' : 'gold';
		this.questions = sanitizeQuestions(questions);
		const s = settings || {};
		this.settings = {
			endBy: s.endBy === 'goal' ? 'goal' : 'time',
			minutes: Math.max(1, Math.min(60, Number(s.minutes) || 7)),
			goal: Math.max(100, Math.min(10_000_000, Number(s.goal) || 5000)),
			shuffle: s.shuffle !== false,
			timeOverride: Number(s.timeOverride) > 0 ? Math.max(5, Math.min(300, Number(s.timeOverride))) : null
		};
		this.status = 'lobby'; // lobby | playing | ended
		this.players = new Map(); // id -> player
		this.tokens = new Map(); // token -> id
		this.feed = [];
		this.dragonPool = 0;
		this.endsAt = null;
		this.startedAt = null;
		this.lastActivity = Date.now();
		this.classic = { index: -1, phase: 'idle', startedAt: 0, answers: new Map(), timer: null };
		this._flushTimer = null;
		this._endTimer = null;
		games.set(this.pin, this);
	}

	get hostRoom() {
		return `host:${this.pin}`;
	}
	get playRoom() {
		return `play:${this.pin}`;
	}

	touch() {
		this.lastActivity = Date.now();
	}

	// ----- players -----
	addPlayer(name, avatar) {
		name = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
		if (!name) return { error: 'Pick a nickname first!' };
		if (this.status === 'ended') return { error: 'This game has already ended' };
		if (this.mode === 'classic' && this.status !== 'lobby') return { error: 'This game has already started' };
		if (this.players.size >= MAX_PLAYERS) return { error: 'This game is full' };
		const lower = name.toLowerCase();
		for (const p of this.players.values()) if (p.name.toLowerCase() === lower) return { error: 'Someone already has that name' };
		const p = {
			id: randomUUID().slice(0, 8),
			token: randomUUID(),
			name,
			avatar: sanitizeAvatar(avatar),
			socketId: null,
			connected: false,
			gold: 0,
			score: 0,
			streak: 0,
			correct: 0,
			answered: 0,
			joinedAt: Date.now(),
			// gold quest
			order: [],
			cursor: 0,
			qIndex: null,
			gq: 'idle', // idle | question | chest | target
			chests: null,
			pending: null
		};
		this.players.set(p.id, p);
		this.tokens.set(p.token, p.id);
		this.pushFeed({ kind: 'join', actor: p.id });
		this.touch();
		this.scheduleHostUpdate();
		return { player: p };
	}

	playerByToken(token) {
		const id = this.tokens.get(token);
		return id ? this.players.get(id) : null;
	}

	removePlayer(id) {
		const p = this.players.get(id);
		if (!p) return;
		this.players.delete(id);
		this.tokens.delete(p.token);
		if (p.socketId) {
			this.io.to(p.socketId).emit('player:kicked');
			this.io.in(p.socketId).socketsLeave(this.playRoom);
		}
		this.scheduleHostUpdate();
		if (this.mode === 'classic') this.maybeFinishClassicQuestion();
	}

	publicPlayer(p) {
		return {
			id: p.id,
			name: p.name,
			avatar: p.avatar,
			gold: p.gold,
			score: p.score,
			correct: p.correct,
			answered: p.answered,
			streak: p.streak,
			connected: p.connected
		};
	}

	standings() {
		const key = this.mode === 'gold' ? 'gold' : 'score';
		return [...this.players.values()]
			.sort((a, b) => b[key] - a[key] || b.correct - a.correct || a.joinedAt - b.joinedAt)
			.map((p) => this.publicPlayer(p));
	}

	rankOf(p) {
		return this.standings().findIndex((s) => s.id === p.id) + 1;
	}

	// ----- host snapshot -----
	hostState() {
		const c = this.classic;
		const q = this.questions[c.index];
		return {
			pin: this.pin,
			title: this.title,
			mode: this.mode,
			status: this.status,
			settings: this.settings,
			questionCount: this.questions.length,
			endsAt: this.endsAt,
			serverNow: Date.now(),
			dragonPool: this.dragonPool,
			players: this.standings(),
			feed: this.feed.slice(-25),
			classic:
				this.mode === 'classic'
					? {
							index: c.index,
							phase: c.phase,
							startedAt: c.startedAt,
							question: q ? { text: q.text, answers: q.answers, time: this.timeFor(q), correct: c.phase === 'question' ? null : q.correct } : null,
							answeredCount: c.answers.size,
							distribution: c.phase === 'question' ? null : this.distribution()
						}
					: null
		};
	}

	scheduleHostUpdate() {
		if (this._flushTimer) return;
		this._flushTimer = setTimeout(() => {
			this._flushTimer = null;
			this.io.to(this.hostRoom).emit('host:state', this.hostState());
		}, 80);
	}

	pushFeed(entry) {
		this.feed.push({ id: randomUUID().slice(0, 8), at: Date.now(), ...entry });
		if (this.feed.length > 60) this.feed.splice(0, this.feed.length - 60);
	}

	gameInfo() {
		return { pin: this.pin, title: this.title, mode: this.mode, status: this.status, endsAt: this.endsAt, serverNow: Date.now(), settings: this.settings, questionCount: this.questions.length };
	}

	// ----- lifecycle -----
	start() {
		if (this.status !== 'lobby') return { error: 'Already started' };
		if (!this.questions.length) return { error: 'No questions' };
		if (!this.players.size) return { error: 'Wait for at least one player to join' };
		this.status = 'playing';
		this.startedAt = Date.now();
		this.touch();
		if (this.mode === 'gold') {
			if (this.settings.endBy === 'time') {
				this.endsAt = Date.now() + this.settings.minutes * 60_000;
				this._endTimer = setTimeout(() => this.end(), this.endsAt - Date.now());
			}
			this.io.to(this.playRoom).emit('game:started', this.gameInfo());
		} else {
			this.io.to(this.playRoom).emit('game:started', this.gameInfo());
			this.nextClassicQuestion();
		}
		this.scheduleHostUpdate();
		return { ok: true };
	}

	end() {
		if (this.status === 'ended') return;
		this.status = 'ended';
		this.endsAt = Date.now();
		clearTimeout(this._endTimer);
		clearTimeout(this.classic.timer);
		const standings = this.standings();
		for (const p of this.players.values()) {
			if (!p.socketId) continue;
			this.io.to(p.socketId).emit('game:end', {
				mode: this.mode,
				podium: standings.slice(0, 3),
				rank: standings.findIndex((s) => s.id === p.id) + 1,
				total: standings.length,
				me: this.publicPlayer(p)
			});
		}
		this.scheduleHostUpdate();
	}

	timeFor(q) {
		return this.settings.timeOverride || q.time || 20;
	}

	// ---------- Gold Quest ----------
	gqNext(p) {
		if (this.mode !== 'gold' || this.status !== 'playing') return { error: 'not-playing' };
		if (p.gq === 'chest' || p.gq === 'target') return { error: 'finish your chest first' };
		if (p.gq === 'question' && p.qIndex !== null) return { question: this.publicQuestion(p.qIndex) };
		if (p.cursor >= p.order.length) {
			const idx = this.questions.map((_, i) => i);
			p.order = this.settings.shuffle ? shuffle(idx) : idx;
			p.cursor = 0;
		}
		p.qIndex = p.order[p.cursor++];
		p.gq = 'question';
		return { question: this.publicQuestion(p.qIndex) };
	}

	publicQuestion(i) {
		const q = this.questions[i];
		return { text: q.text, answers: q.answers, multi: q.correct.length > 1, time: this.timeFor(q) };
	}

	gqAnswer(p, answer) {
		if (this.mode !== 'gold' || this.status !== 'playing' || p.gq !== 'question') return { error: 'no-question' };
		const q = this.questions[p.qIndex];
		const correct = isCorrect(q, answer);
		p.answered++;
		this.touch();
		if (correct) {
			p.correct++;
			p.streak++;
			const hasOthers = this.players.size > 1;
			p.chests = [0, 1, 2].map(() => rollChest({ hasOthers, dragonPool: this.dragonPool }));
			p.gq = 'chest';
		} else {
			p.streak = 0;
			p.gq = 'idle';
			p.qIndex = null;
		}
		this.scheduleHostUpdate();
		return { correct, correctAnswers: q.correct };
	}

	gqPick(p, choice) {
		if (p.gq !== 'chest' || !p.chests) return { error: 'no-chest' };
		const i = Number(choice);
		if (![0, 1, 2].includes(i)) return { error: 'bad-chest' };
		const chests = p.chests;
		const reward = chests[i];
		p.chests = null;
		p.qIndex = null;
		const before = p.gold;
		let needsTarget = false;
		switch (reward.type) {
			case 'gold':
				p.gold += reward.amount;
				break;
			case 'mult':
				p.gold *= reward.factor;
				break;
			case 'lose': {
				const lost = Math.round((p.gold * reward.pct) / 100);
				p.gold -= lost;
				this.dragonPool += lost;
				reward.amount = lost;
				break;
			}
			case 'dragon':
				reward.amount = this.dragonPool;
				p.gold += this.dragonPool;
				this.dragonPool = 0;
				break;
			case 'take':
			case 'swap':
				needsTarget = this.players.size > 1;
				if (!needsTarget) reward.type = 'nothing';
				break;
		}
		if (needsTarget) {
			p.gq = 'target';
			p.pending = reward;
		} else {
			p.gq = 'idle';
			this.pushFeed({ kind: reward.type, actor: p.id, amount: reward.amount, factor: reward.factor, pct: reward.pct, gold: p.gold, delta: p.gold - before });
		}
		this.touch();
		this.scheduleHostUpdate();
		const result = { chests, picked: i, reward, gold: p.gold, delta: p.gold - before, dragonPool: this.dragonPool };
		if (needsTarget) result.targets = this.targetsFor(p);
		this.checkGoal(p);
		return result;
	}

	targetsFor(p) {
		return this.standings().filter((s) => s.id !== p.id);
	}

	gqTarget(p, targetId) {
		if (p.gq !== 'target' || !p.pending) return { error: 'no-target-needed' };
		const t = this.players.get(String(targetId));
		if (!t || t.id === p.id) return { error: 'Pick another player' };
		const reward = p.pending;
		p.pending = null;
		p.gq = 'idle';
		const before = p.gold;
		let amount = 0;
		if (reward.type === 'take') {
			amount = Math.round((t.gold * reward.pct) / 100);
			t.gold -= amount;
			p.gold += amount;
		} else if (reward.type === 'swap') {
			[p.gold, t.gold] = [t.gold, p.gold];
		}
		const evt = { kind: reward.type, actor: p.id, target: t.id, amount, pct: reward.pct, gold: p.gold, delta: p.gold - before };
		this.pushFeed(evt);
		if (t.socketId) {
			this.io.to(t.socketId).emit('gq:hit', {
				kind: reward.type,
				pct: reward.pct,
				amount,
				by: this.publicPlayer(p),
				gold: t.gold
			});
		}
		this.touch();
		this.scheduleHostUpdate();
		this.checkGoal(p);
		return { gold: p.gold, delta: p.gold - before, target: this.publicPlayer(t), amount, kind: reward.type };
	}

	checkGoal(p) {
		if (this.mode === 'gold' && this.settings.endBy === 'goal' && p.gold >= this.settings.goal) {
			// let the reveal animation finish before ending
			setTimeout(() => this.end(), 1800);
		}
	}

	// ---------- Classic ----------
	nextClassicQuestion() {
		const c = this.classic;
		clearTimeout(c.timer);
		c.index++;
		if (c.index >= this.questions.length) return this.end();
		c.phase = 'question';
		c.answers = new Map();
		c.startedAt = Date.now() + 3000; // 3s "get ready" countdown
		const q = this.questions[c.index];
		const time = this.timeFor(q);
		this.io.to(this.playRoom).emit('classic:question', {
			index: c.index,
			total: this.questions.length,
			answers: q.answers,
			text: q.text,
			multi: q.correct.length > 1,
			time,
			startsAt: c.startedAt,
			serverNow: Date.now()
		});
		c.timer = setTimeout(() => this.revealClassic(), 3000 + time * 1000 + 300);
		this.scheduleHostUpdate();
	}

	classicAnswer(p, answer) {
		const c = this.classic;
		if (this.mode !== 'classic' || c.phase !== 'question') return { error: 'too-late' };
		if (c.answers.has(p.id)) return { error: 'already-answered' };
		const now = Date.now();
		if (now < c.startedAt) return { error: 'not-yet' };
		const q = this.questions[c.index];
		const limit = this.timeFor(q) * 1000;
		const elapsed = Math.min(limit, now - c.startedAt);
		const correct = isCorrect(q, answer);
		let points = 0;
		p.answered++;
		if (correct) {
			p.correct++;
			p.streak++;
			points = Math.round(1000 * (1 - elapsed / limit / 2)) + Math.min(p.streak - 1, 5) * 50;
		} else p.streak = 0;
		p.score += points;
		c.answers.set(p.id, { answer, correct, points, elapsed });
		this.touch();
		this.scheduleHostUpdate();
		this.maybeFinishClassicQuestion();
		return { ok: true };
	}

	maybeFinishClassicQuestion() {
		const c = this.classic;
		if (c.phase !== 'question') return;
		const active = [...this.players.values()].filter((p) => p.connected);
		if (active.length && active.every((p) => c.answers.has(p.id))) this.revealClassic();
	}

	distribution() {
		const q = this.questions[this.classic.index];
		const counts = q ? q.answers.map(() => 0) : [];
		for (const a of this.classic.answers.values()) for (const i of [].concat(a.answer)) if (counts[i] !== undefined) counts[i]++;
		return counts;
	}

	revealClassic() {
		const c = this.classic;
		if (c.phase !== 'question') return;
		clearTimeout(c.timer);
		c.phase = 'reveal';
		const q = this.questions[c.index];
		const standings = this.standings();
		for (const p of this.players.values()) {
			if (!p.socketId) continue;
			const a = c.answers.get(p.id);
			if (!a) p.streak = 0;
			this.io.to(p.socketId).emit('classic:result', {
				index: c.index,
				answered: !!a,
				correct: !!a?.correct,
				points: a?.points ?? 0,
				score: p.score,
				streak: p.streak,
				rank: standings.findIndex((s) => s.id === p.id) + 1,
				total: standings.length,
				correctAnswers: q.correct,
				answers: q.answers,
				last: c.index >= this.questions.length - 1
			});
		}
		this.scheduleHostUpdate();
	}

	classicNext() {
		const c = this.classic;
		if (this.mode !== 'classic' || this.status !== 'playing') return { error: 'not-playing' };
		if (c.phase === 'question') this.revealClassic();
		else if (c.phase === 'reveal') {
			c.phase = 'leaderboard';
			this.io.to(this.playRoom).emit('classic:leaderboard');
			this.scheduleHostUpdate();
		} else if (c.phase === 'leaderboard') this.nextClassicQuestion();
		return { ok: true };
	}

	destroy() {
		clearTimeout(this._endTimer);
		clearTimeout(this.classic.timer);
		clearTimeout(this._flushTimer);
		games.delete(this.pin);
	}
}

export function isCorrect(q, answer) {
	const given = [...new Set([].concat(answer).map(Number))].sort();
	if (q.correct.length > 1) {
		// multi-answer: any single correct pick counts (like Blooket), or an exact set
		return given.length > 0 && given.every((g) => q.correct.includes(g));
	}
	return given.length === 1 && given[0] === q.correct[0];
}

// clean up stale games every 10 minutes
setInterval(() => {
	const now = Date.now();
	for (const g of games.values()) {
		const idle = now - g.lastActivity;
		if ((g.status === 'ended' && idle > 60 * 60_000) || idle > 4 * 60 * 60_000) g.destroy();
	}
}, 10 * 60_000).unref();
