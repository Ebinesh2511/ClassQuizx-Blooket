import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvToQuestions, parseCSV, SAMPLE_CSV } from './csv.js';

test('sample CSV parses fully', () => {
	const { questions, errors } = csvToQuestions(SAMPLE_CSV);
	assert.equal(errors.length, 0);
	assert.equal(questions.length, 10);
	assert.deepEqual(questions[0].correct, [1]);
	assert.deepEqual(questions[5].correct, [0, 2]);
});

test('quoted fields with commas and escaped quotes', () => {
	const rows = parseCSV('a,"b, c","say ""hi"""\r\n1,2,3');
	assert.deepEqual(rows, [['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
});

test('letters, answer text, headerless, semicolon delimited', () => {
	const r1 = csvToQuestions('Q?,x,y,z,w,C');
	assert.deepEqual(r1.questions[0].correct, [2]);
	const r2 = csvToQuestions('Question;A1;A2;Correct\nSky?;Blue;Green;blue');
	assert.deepEqual(r2.questions[0].correct, [0]);
});

test('Blooket template layout', () => {
	const csv = `"Blooket\nImport Template",,,,,,,,
Question #,Question Text,Answer 1,Answer 2,"Answer 3\n(Optional)","Answer 4\n(Optional)","Time Limit (sec)\n(Max: 300 seconds)","Correct Answer(s)\n(Only include Answer #)"
1,What is 2+2?,3,4,,,20,2
2,Pick evens,2,3,4,5,30,"1,3"`;
	const { questions, errors } = csvToQuestions(csv);
	assert.equal(errors.length, 0);
	assert.equal(questions.length, 2);
	assert.deepEqual(questions[0].answers, ['3', '4']);
	assert.deepEqual(questions[0].correct, [1]);
	assert.equal(questions[1].time, 30);
	assert.deepEqual(questions[1].correct, [0, 2]);
});

test('bad rows are reported, not fatal', () => {
	const { questions, errors } = csvToQuestions('Question,Answer 1,Answer 2,Correct\nOk?,a,b,1\nBad?,a,,1\nNope?,a,b,9');
	assert.equal(questions.length, 1);
	assert.equal(errors.length, 2);
});

import { liveFeed } from './rewards.js';
test('liveFeed is newest-first and hides joins during play', () => {
	const feed = [
		{ id: 1, kind: 'join', at: 1 },
		{ id: 2, kind: 'gold', at: 2 },
		{ id: 3, kind: 'swap', at: 3 }
	];
	assert.deepEqual(liveFeed(feed, 'playing').map((e) => e.id), [3, 2]);
	assert.deepEqual(liveFeed(feed, 'lobby').map((e) => e.id), [3, 2, 1]);
});
