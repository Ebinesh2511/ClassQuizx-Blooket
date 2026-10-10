import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, rollChest, isCorrect } from './game.js';

const fakeIo = () => {
	const sent = [];
	const target = (room) => ({ emit: (ev, data) => sent.push({ room, ev, data }), socketsLeave() {} });
	return { sent, to: target, in: target };
};
const qs = [
	{ text: 'A?', answers: ['x', 'y'], correct: [0], time: 10 },
	{ text: 'B?', answers: ['x', 'y', 'z'], correct: [1, 2], time: 10 }
];

test('rollChest respects context', () => {
	for (let i = 0; i < 500; i++) {
		const r = rollChest({ hasOthers: false, dragonPool: 0 });
		assert.ok(!['take', 'swap', 'dragon'].includes(r.type));
	}
});

test('isCorrect single and multi', () => {
	assert.ok(isCorrect(qs[0], [0]));
	assert.ok(!isCorrect(qs[0], [1]));
	assert.ok(isCorrect(qs[1], [1]));
	assert.ok(isCorrect(qs[1], [1, 2]));
	assert.ok(!isCorrect(qs[1], [0, 1]));
});

test('gold quest full loop: answer, chest, take, swap, dragon', () => {
	const g = new Game(fakeIo(), { questions: qs, mode: 'gold', settings: { minutes: 1 } });
	const a = g.addPlayer('Ann', {}).player;
	const b = g.addPlayer('Bob', {}).player;
	assert.equal(g.addPlayer('ann', {}).error, 'Someone already has that name');
	assert.ok(g.start().ok);

	// correct answer gives 3 chests
	const q = g.gqNext(a).question;
	const idx = g.questions.findIndex((x) => x.text === q.text);
	const res = g.gqAnswer(a, g.questions[idx].correct);
	assert.ok(res.correct);
	assert.equal(a.chests.length, 3);

	// force a gold chest
	a.chests = [{ type: 'gold', amount: 50 }, { type: 'nothing' }, { type: 'nothing' }];
	assert.equal(g.gqPick(a, 0).gold, 50);

	// take 10% from a
	b.gq = 'chest';
	b.chests = [{ type: 'take', pct: 10 }, { type: 'nothing' }, { type: 'nothing' }];
	const r = g.gqPick(b, 0);
	assert.ok(r.targets.length === 1);
	const t = g.gqTarget(b, a.id);
	assert.equal(t.amount, 5);
	assert.equal(a.gold, 45);
	assert.equal(b.gold, 5);

	// swap
	b.gq = 'chest';
	b.chests = [{ type: 'swap' }, { type: 'nothing' }, { type: 'nothing' }];
	g.gqPick(b, 0);
	g.gqTarget(b, a.id);
	assert.equal(b.gold, 45);
	assert.equal(a.gold, 5);

	// dragon takes 25%, then dragon's treasure pays it out
	b.gq = 'chest';
	b.chests = [{ type: 'lose', pct: 25 }, { type: 'nothing' }, { type: 'nothing' }];
	g.gqPick(b, 0);
	assert.equal(g.dragonPool, 11);
	a.gq = 'chest';
	a.chests = [{ type: 'dragon' }, { type: 'nothing' }, { type: 'nothing' }];
	g.gqPick(a, 0);
	assert.equal(a.gold, 16);
	assert.equal(g.dragonPool, 0);

	// wrong answer: no chest
	const q2 = g.gqNext(a).question;
	const i2 = g.questions.findIndex((x) => x.text === q2.text);
	const wrong = g.questions[i2].answers.findIndex((_, k) => !g.questions[i2].correct.includes(k));
	assert.equal(g.gqAnswer(a, [wrong]).correct, false);
	assert.equal(g.gqPick(a, 0).error, 'no-chest');

	assert.equal(g.standings()[0].id, b.id);
	g.end();
	assert.equal(g.status, 'ended');
	g.destroy();
});

test('classic: scoring and phases', () => {
	const g = new Game(fakeIo(), { questions: qs, mode: 'classic' });
	const a = g.addPlayer('Ann', {}).player;
	a.connected = true;
	g.start();
	assert.equal(g.classic.phase, 'question');
	g.classic.startedAt = Date.now() - 1000; // skip get-ready
	g.classicAnswer(a, [0]);
	assert.ok(a.score > 900 && a.score <= 1000);
	assert.equal(g.classic.phase, 'reveal'); // everyone answered
	g.classicNext();
	assert.equal(g.classic.phase, 'leaderboard');
	g.classicNext();
	assert.equal(g.classic.index, 1);
	assert.equal(g.addPlayer('Late', {}).error, 'This game has already started');
	g.destroy();
});
