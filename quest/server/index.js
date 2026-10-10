import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { Game, getGame } from './game.js';
import { sanitizeAvatar } from '../src/lib/avatars.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: true }, maxHttpBufferSize: 2e6 });

function lanUrls() {
	const out = [];
	for (const list of Object.values(networkInterfaces()))
		for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${PORT}`);
	return out;
}

app.get('/api/info', (_req, res) => res.json({ lan: process.env.PUBLIC_URL ? [process.env.PUBLIC_URL] : lanUrls() }));
app.get('/api/game/:pin', (req, res) => {
	const g = getGame(req.params.pin);
	if (!g) return res.status(404).json({ error: 'Game not found' });
	res.json({ pin: g.pin, title: g.title, mode: g.mode, status: g.status });
});

const safe = (fn) => (...args) => {
	const ack = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
	try {
		ack(fn(...args) ?? { ok: true });
	} catch (e) {
		console.error(e);
		ack({ error: 'Something went wrong' });
	}
};

io.on('connection', (socket) => {
	let game = null;
	let player = null;
	let isHost = false;

	const attachPlayer = (g, p) => {
		if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('player:replaced');
		game = g;
		player = p;
		p.socketId = socket.id;
		p.connected = true;
		socket.join(g.playRoom);
		g.scheduleHostUpdate();
	};

	const playerSnapshot = () => {
		const g = game;
		const p = player;
		const snap = { game: g.gameInfo(), me: g.publicPlayer(p), playerId: p.id, token: p.token, rank: g.rankOf(p), total: g.players.size };
		if (g.mode === 'gold') {
			snap.gq = { state: p.gq, dragonPool: g.dragonPool };
			if (p.gq === 'question') snap.gq.question = g.publicQuestion(p.qIndex);
			if (p.gq === 'target') {
				snap.gq.pending = p.pending;
				snap.gq.targets = g.targetsFor(p);
			}
		} else if (g.status === 'playing') {
			const c = g.classic;
			const q = g.questions[c.index];
			snap.classic = { phase: c.phase, index: c.index, total: g.questions.length, answered: c.answers.has(p.id) };
			if (q && c.phase === 'question')
				snap.classic.question = { index: c.index, total: g.questions.length, text: q.text, answers: q.answers, multi: q.correct.length > 1, time: g.timeFor(q), startsAt: c.startedAt, serverNow: Date.now() };
		}
		if (g.status === 'ended') {
			const st = g.standings();
			snap.end = { mode: g.mode, podium: st.slice(0, 3), rank: g.rankOf(p), total: st.length, me: g.publicPlayer(p) };
		}
		return snap;
	};

	// ----- host -----
	socket.on('host:create', safe((payload) => {
		const g = new Game(io, payload || {});
		if (!g.questions.length) {
			g.destroy();
			return { error: 'The quiz needs at least one valid question' };
		}
		game = g;
		isHost = true;
		socket.join(g.hostRoom);
		g.scheduleHostUpdate();
		return { pin: g.pin, hostToken: g.hostToken, state: g.hostState() };
	}));

	socket.on('host:resume', safe(({ pin, hostToken } = {}) => {
		const g = getGame(pin);
		if (!g || g.hostToken !== hostToken) return { error: 'Game not found' };
		game = g;
		isHost = true;
		socket.join(g.hostRoom);
		return { pin: g.pin, state: g.hostState(), questions: g.questions };
	}));

	const hostOnly = (fn) => safe((...a) => (isHost && game ? fn(...a) : { error: 'Not the host' }));
	socket.on('host:start', hostOnly(() => game.start()));
	socket.on('host:end', hostOnly(() => (game.end(), { ok: true })));
	socket.on('host:kick', hostOnly(({ playerId } = {}) => (game.removePlayer(String(playerId)), { ok: true })));
	socket.on('host:next', hostOnly(() => game.classicNext()));
	socket.on('host:extend', hostOnly(({ minutes } = {}) => {
		if (game.mode !== 'gold' || game.status !== 'playing' || !game.endsAt) return { error: 'Cannot extend' };
		game.endsAt += Math.max(1, Math.min(10, Number(minutes) || 1)) * 60_000;
		clearTimeout(game._endTimer);
		game._endTimer = setTimeout(() => game.end(), game.endsAt - Date.now());
		io.to(game.playRoom).emit('game:time', { endsAt: game.endsAt, serverNow: Date.now() });
		game.scheduleHostUpdate();
		return { ok: true };
	}));

	// ----- players -----
	socket.on('player:check', safe(({ pin } = {}) => {
		const g = getGame(pin);
		if (!g) return { error: "We couldn't find a game with that code" };
		if (g.status === 'ended') return { error: 'That game has already ended' };
		if (g.mode === 'classic' && g.status !== 'lobby') return { error: 'That game has already started' };
		return { ok: true, title: g.title, mode: g.mode };
	}));

	socket.on('player:join', safe(({ pin, name, avatar } = {}) => {
		const g = getGame(pin);
		if (!g) return { error: "We couldn't find a game with that code" };
		const r = g.addPlayer(name, avatar);
		if (r.error) return r;
		attachPlayer(g, r.player);
		return playerSnapshot();
	}));

	socket.on('player:resume', safe(({ pin, token } = {}) => {
		const g = getGame(pin);
		const p = g?.playerByToken(token);
		if (!p) return { error: 'gone' };
		attachPlayer(g, p);
		return playerSnapshot();
	}));

	socket.on('player:avatar', safe(({ avatar } = {}) => {
		if (!player || game.status !== 'lobby') return { error: 'nope' };
		player.avatar = sanitizeAvatar(avatar);
		game.scheduleHostUpdate();
		return { avatar: player.avatar };
	}));

	const playing = (fn) => safe((...a) => (player && game && game.players.has(player.id) ? fn(...a) : { error: 'Not in a game' }));
	socket.on('gq:next', playing(() => game.gqNext(player)));
	socket.on('gq:answer', playing(({ answer } = {}) => game.gqAnswer(player, answer)));
	socket.on('gq:pick', playing(({ chest } = {}) => game.gqPick(player, chest)));
	socket.on('gq:target', playing(({ playerId } = {}) => game.gqTarget(player, playerId)));
	socket.on('gq:standing', playing(() => ({ rank: game.rankOf(player), total: game.players.size, gold: player.gold, dragonPool: game.dragonPool })));
	socket.on('classic:answer', playing(({ answer } = {}) => game.classicAnswer(player, answer)));

	socket.on('disconnect', () => {
		if (player && game && player.socketId === socket.id) {
			player.connected = false;
			player.socketId = null;
			game.scheduleHostUpdate();
			if (game.mode === 'classic') game.maybeFinishClassicQuestion();
		}
	});
});

// ----- frontend -----
if (dev) {
	const { createServer: createVite } = await import('vite');
	const vite = await createVite({ root, server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' });
	app.use(vite.middlewares);
} else {
	const dist = path.join(root, 'dist');
	app.use(express.static(dist, { maxAge: '1h', index: false }));
	app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

http.listen(PORT, '0.0.0.0', () => {
	console.log(`\n  🦊 QuizQuest running at http://localhost:${PORT}`);
	for (const u of lanUrls()) console.log(`     on your network: ${u}`);
	console.log('');
});
