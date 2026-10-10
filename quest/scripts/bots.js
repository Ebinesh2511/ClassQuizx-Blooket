// Fill a game with bot players for demos and load testing.
// usage: node scripts/bots.js <PIN> [count=8] [url=http://localhost:3000]
import { io } from 'socket.io-client';
import { randomAvatar, randomName } from '../src/lib/avatars.js';

const [pin, count = 8, url = 'http://localhost:3000'] = process.argv.slice(2);
if (!pin) {
	console.log('usage: node scripts/bots.js <PIN> [count] [url]');
	process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, data) => new Promise((r) => s.emit(ev, data, r));

async function bot(n) {
	const s = io(url, { transports: ['websocket'] });
	await new Promise((r) => s.on('connect', r));
	const avatar = randomAvatar();
	let res;
	for (let tries = 0; tries < 5; tries++) {
		res = await ack(s, 'player:join', { pin, name: randomName(avatar), avatar });
		if (!res.error) break;
	}
	if (res.error) return console.log(`bot ${n}: ${res.error}`);
	console.log(`🤖 ${res.me.name} joined`);
	const skill = 0.5 + Math.random() * 0.45;
	let ended = false;
	const memory = new Map(); // bots learn answers as they play
	s.on('game:end', (e) => {
		ended = true;
		console.log(`🏁 ${res.me.name} finished #${e.rank}`);
		s.close();
	});
	s.on('classic:question', async (q) => {
		await sleep(q.startsAt - q.serverNow + 600 + Math.random() * q.time * 600);
		s.emit('classic:answer', { answer: [Math.floor(Math.random() * q.answers.length)] }, () => {});
	});
	const goldLoop = async () => {
		while (!ended) {
			const r = await ack(s, 'gq:next', {});
			if (r.error) {
				await sleep(800);
				continue;
			}
			await sleep(1500 + Math.random() * 3500);
			const q = r.question;
			const known = memory.get(q.text);
			const guess = known && Math.random() < skill ? known : [Math.floor(Math.random() * q.answers.length)];
			const a = await ack(s, 'gq:answer', { answer: guess });
			if (a?.correctAnswers) memory.set(q.text, [a.correctAnswers[0]]);
			if (a?.correct) {
				await sleep(900);
				const p = await ack(s, 'gq:pick', { chest: Math.floor(Math.random() * 3) });
				if (p.targets?.length) {
					await sleep(1200);
					await ack(s, 'gq:target', { playerId: p.targets[Math.floor(Math.random() * Math.min(3, p.targets.length))].id });
				}
			}
			await sleep(1200);
		}
	};
	s.on('game:started', (g) => g.mode === 'gold' && goldLoop());
}

for (let i = 0; i < Number(count); i++) {
	bot(i);
	await sleep(400 + Math.random() * 600);
}
