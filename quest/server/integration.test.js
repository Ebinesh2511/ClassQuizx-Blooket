// End-to-end tests: real server process + real Socket.IO clients.
// Covers the join system, QR/info endpoints, Gold Quest live action feed, and Classic rounds.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { liveFeed, feedText } from '../src/lib/rewards.js';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
let server;
const clients = [];

const QUESTIONS = [
	{ text: 'Q1', answers: ['a', 'b', 'c', 'd'], correct: [1], time: 5 },
	{ text: 'Q2', answers: ['a', 'b'], correct: [0], time: 5 }
];
const correctFor = (text) => QUESTIONS.find((q) => q.text === text).correct;

before(async () => {
	server = spawn(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url))], {
		env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
		stdio: ['ignore', 'pipe', 'inherit']
	});
	await new Promise((resolve, reject) => {
		server.stdout.on('data', (d) => String(d).includes('running') && resolve());
		server.on('exit', (c) => reject(new Error('server exited ' + c)));
	});
});

after(() => {
	clients.forEach((c) => c.close());
	server?.kill();
});

async function client() {
	const s = io(BASE, { transports: ['websocket'], forceNew: true });
	clients.push(s);
	await new Promise((r) => s.on('connect', r));
	return s;
}
const ack = (s, ev, data = {}) => new Promise((r) => s.emit(ev, data, r));
const next = (s, ev, pred = () => true, ms = 4000) =>
	new Promise((resolve, reject) => {
		const t = setTimeout(() => (s.off(ev, h), reject(new Error(`timeout waiting for ${ev}`))), ms);
		const h = (d) => pred(d) && (clearTimeout(t), s.off(ev, h), resolve(d));
		s.on(ev, h);
	});

async function hostGame(mode = 'gold', settings = {}) {
	const host = await client();
	const r = await ack(host, 'host:create', { questions: QUESTIONS, mode, title: 'Test', settings });
	assert.ok(r.pin, 'game created');
	return { host, pin: r.pin, hostToken: r.hostToken };
}

// ---------------------------------------------------------------- join system
test('join: QR info endpoint and game lookup', async () => {
	const { pin } = await hostGame();
	const info = await (await fetch(`${BASE}/api/info`)).json();
	assert.ok(Array.isArray(info.lan));
	const g = await (await fetch(`${BASE}/api/game/${pin}`)).json();
	assert.equal(g.mode, 'gold');
	assert.equal(g.status, 'lobby');
	assert.equal((await fetch(`${BASE}/api/game/000000`)).status, 404);
});

test('join: validation, lobby updates, avatar, resume and kick', async () => {
	const { host, pin, hostToken } = await hostGame();
	const p = await client();

	assert.match((await ack(p, 'player:check', { pin: '000000' })).error, /couldn't find/);
	assert.ok((await ack(p, 'player:check', { pin })).ok);
	assert.match((await ack(p, 'player:join', { pin, name: '   ' })).error, /nickname/);

	const lobby = next(host, 'host:state', (s) => s.players.length === 1);
	const joined = await ack(p, 'player:join', { pin, name: 'Sneaky Fox', avatar: { animal: 999, color: -1, hat: 'x' } });
	assert.equal(joined.me.name, 'Sneaky Fox');
	assert.ok(joined.token);
	// junk avatar values get replaced by valid ones
	assert.ok(joined.me.avatar.animal >= 0 && joined.me.avatar.animal < 40);
	const state = await lobby;
	assert.equal(state.players[0].name, 'Sneaky Fox');
	assert.equal(state.players[0].connected, true);
	// lobby shows the join event in the feed
	assert.equal(liveFeed(state.feed, 'lobby')[0].kind, 'join');

	const dup = await client();
	assert.match((await ack(dup, 'player:join', { pin, name: 'sneaky fox' })).error, /already has that name/);

	// avatar change in lobby
	const changed = await ack(p, 'player:avatar', { avatar: { animal: 3, color: 2, hat: 1 } });
	assert.deepEqual(changed.avatar, { animal: 3, color: 2, hat: 1 });

	// refresh: resume with token keeps the same player
	const p2 = await client();
	const resumed = await ack(p2, 'player:resume', { pin, token: joined.token });
	assert.equal(resumed.playerId, joined.playerId);
	assert.equal((await ack(p2, 'player:resume', { pin, token: 'nope' })).error, 'gone');

	// only the real host can control the game
	assert.equal((await ack(p2, 'host:start')).error, 'Not the host');
	const intruder = await client();
	assert.ok((await ack(intruder, 'host:resume', { pin, hostToken: 'wrong' })).error);
	const host2 = await client();
	assert.equal((await ack(host2, 'host:resume', { pin, hostToken })).pin, pin);

	// kick
	const kicked = next(p2, 'player:kicked');
	await ack(host, 'host:kick', { playerId: joined.playerId });
	await kicked;
	const after = await next(host, 'host:state', (s) => s.players.length === 0);
	assert.equal(after.players.length, 0);
});

test('join: cannot start empty game; classic blocks late joins, gold allows them', async () => {
	const gold = await hostGame('gold');
	assert.match((await ack(gold.host, 'host:start')).error, /at least one player/);
	const a = await client();
	await ack(a, 'player:join', { pin: gold.pin, name: 'Ann' });
	assert.ok((await ack(gold.host, 'host:start')).ok);
	const late = await client();
	const lj = await ack(late, 'player:join', { pin: gold.pin, name: 'Late' });
	assert.equal(lj.game.status, 'playing');

	const classic = await hostGame('classic');
	const b = await client();
	await ack(b, 'player:join', { pin: classic.pin, name: 'Bob' });
	await ack(classic.host, 'host:start');
	const late2 = await client();
	assert.match((await ack(late2, 'player:check', { pin: classic.pin })).error, /already started/);
	assert.match((await ack(late2, 'player:join', { pin: classic.pin, name: 'Late' })).error, /already started/);
	await ack(classic.host, 'host:end');
});

// ---------------------------------------------------------------- live action
async function answerUntilChest(p) {
	for (let i = 0; i < 10; i++) {
		const { question } = await ack(p, 'gq:next');
		const r = await ack(p, 'gq:answer', { answer: correctFor(question.text) });
		if (r.correct) return;
	}
	throw new Error('never got a chest');
}

test('live action: chest rewards appear in host feed, newest first', async () => {
	const { host, pin } = await hostGame('gold', { minutes: 5 });
	const a = await client();
	const b = await client();
	const ja = await ack(a, 'player:join', { pin, name: 'Ann' });
	await ack(b, 'player:join', { pin, name: 'Bob' });
	const started = next(a, 'game:started');
	await ack(host, 'host:start');
	assert.equal((await started).mode, 'gold');

	// wrong answer: no chest, no feed event
	const { question } = await ack(a, 'gq:next');
	const wrong = QUESTIONS.find((q) => q.text === question.text).answers.findIndex((_, i) => !correctFor(question.text).includes(i));
	const w = await ack(a, 'gq:answer', { answer: [wrong] });
	assert.equal(w.correct, false);
	assert.equal((await ack(a, 'gq:pick', { chest: 0 })).error, 'no-chest');

	// correct answer -> chest -> host sees it in live action
	await answerUntilChest(a);
	const pick = await ack(a, 'gq:pick', { chest: 1 });
	assert.equal(pick.chests.length, 3);
	if (pick.targets) await ack(a, 'gq:target', { playerId: pick.targets[0].id });
	const st = await next(host, 'host:state', (s) => s.feed.some((e) => e.kind !== 'join'));
	const feed = liveFeed(st.feed, st.status);
	assert.ok(feed.every((e) => e.kind !== 'join'), 'join events hidden while playing');
	assert.equal(feed[0].actor, ja.playerId);
	assert.equal(feed[0].kind, pick.reward.type);
	const names = Object.fromEntries(st.players.map((p) => [p.id, p.name]));
	assert.match(feedText(feed[0], (id) => names[id]).text, /Ann/);
	// leaderboard sorted by gold
	for (let i = 1; i < st.players.length; i++) assert.ok(st.players[i - 1].gold >= st.players[i].gold);

	// several more chests: feed stays newest-first (top-down)
	for (let i = 0; i < 4; i++) {
		await answerUntilChest(a);
		const r = await ack(a, 'gq:pick', { chest: i % 3 });
		if (r.targets) await ack(a, 'gq:target', { playerId: r.targets[0].id });
	}
	const st2 = await next(host, 'host:state', () => true);
	const f2 = liveFeed(st2.feed, st2.status);
	for (let i = 1; i < f2.length; i++) assert.ok(f2[i - 1].at >= f2[i].at, 'newest event on top');
	await ack(host, 'host:end');
});

test('live action: take/swap hits the victim and names them in the feed', async () => {
	const { host, pin } = await hostGame('gold', { minutes: 5 });
	const a = await client();
	const b = await client();
	await ack(a, 'player:join', { pin, name: 'Thief' });
	const jb = await ack(b, 'player:join', { pin, name: 'Victim' });
	await ack(host, 'host:start');

	let done = false;
	for (let i = 0; i < 300 && !done; i++) {
		await answerUntilChest(a);
		const r = await ack(a, 'gq:pick', { chest: 0 });
		if (r.targets) {
			assert.ok(r.targets.every((t) => t.name !== 'Thief'), 'cannot target yourself');
			const hit = next(b, 'gq:hit');
			const t = await ack(a, 'gq:target', { playerId: jb.playerId });
			const h = await hit;
			assert.equal(h.by.name, 'Thief');
			assert.equal(h.kind, t.kind);
			const st = await next(host, 'host:state', (s) => liveFeed(s.feed, s.status)[0]?.target === jb.playerId);
			const top = liveFeed(st.feed, st.status)[0];
			assert.ok(['take', 'swap'].includes(top.kind));
			done = true;
		}
	}
	assert.ok(done, 'got a take or swap chest');
	await ack(host, 'host:end');
});

test('gold quest: timer extend and end broadcast podium', async () => {
	const { host, pin } = await hostGame('gold', { minutes: 1 });
	const a = await client();
	await ack(a, 'player:join', { pin, name: 'Solo' });
	await ack(host, 'host:start');
	const timeEvt = next(a, 'game:time');
	assert.ok((await ack(host, 'host:extend', { minutes: 2 })).ok);
	await timeEvt;
	const ended = next(a, 'game:end');
	await ack(host, 'host:end');
	const e = await ended;
	assert.equal(e.rank, 1);
	assert.equal(e.podium[0].name, 'Solo');
});

// ---------------------------------------------------------------- classic
test('classic: question, answer, result, leaderboard, end', async () => {
	const { host, pin } = await hostGame('classic', { timeOverride: 5 });
	const a = await client();
	await ack(a, 'player:join', { pin, name: 'Quick' });
	const q = next(a, 'classic:question');
	await ack(host, 'host:start');
	const question = await q;
	assert.equal(question.index, 0);
	assert.equal(question.answers.length, 4);
	assert.equal(question.correct, undefined, 'answer not leaked to players');
	assert.equal((await ack(a, 'classic:answer', { answer: [1] })).error, 'not-yet');

	await new Promise((r) => setTimeout(r, question.startsAt - question.serverNow + 50));
	const result = next(a, 'classic:result');
	assert.ok((await ack(a, 'classic:answer', { answer: correctFor(question.text) })).ok);
	const r = await result; // everyone answered -> instant reveal
	assert.equal(r.correct, true);
	assert.ok(r.points > 500);
	assert.equal(r.rank, 1);

	const lb = next(a, 'classic:leaderboard');
	await ack(host, 'host:next');
	await lb;
	const q2 = next(a, 'classic:question');
	await ack(host, 'host:next');
	assert.equal((await q2).index, 1);
	const ended = next(a, 'game:end');
	await ack(host, 'host:end');
	assert.equal((await ended).me.score, r.score);
});
