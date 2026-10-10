// CSV quiz import. Shared by the browser (preview) and the server (validation).
// Accepts a simple format and Blooket's spreadsheet template:
//   Question, Answer 1, Answer 2, Answer 3, Answer 4, Correct Answer, Time Limit
// "Correct Answer" may be a number (1-4), a letter (A-D), the answer text,
// or several of those separated by ; | or , (e.g. "1;3").

export function parseCSV(text) {
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;
	text = String(text).replace(/^﻿/, '');
	const delim = detectDelimiter(text);
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else inQuotes = false;
			} else field += c;
		} else if (c === '"') inQuotes = true;
		else if (c === delim) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

function detectDelimiter(text) {
	const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
	const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length]);
	counts.sort((a, b) => b[1] - a[1]);
	return counts[0][1] > 1 ? counts[0][0] : ',';
}

function findHeader(rows) {
	for (let i = 0; i < Math.min(rows.length, 5); i++) {
		const lower = rows[i].map((c) => c.toLowerCase());
		const hasQ = lower.some((c) => c.includes('question'));
		const hasA = lower.some((c) => /answer|option|choice|correct/.test(c) || /^(a|ans)\s*\d$/.test(c));
		if (hasQ && hasA) return i;
	}
	return -1;
}

function mapColumns(header) {
	const cols = { q: -1, answers: [], correct: -1, time: -1 };
	header.forEach((raw, i) => {
		const h = raw.toLowerCase().trim();
		if (/correct/.test(h)) cols.correct = i;
		else if (/time/.test(h)) cols.time = i;
		else if (/(answer|option|choice)\s*\d/.test(h) || /^(a|ans)\s*\d$/.test(h) || /^[a-f]$/.test(h)) cols.answers.push(i);
		else if (/question/.test(h) && !/#|number|no\.?$/.test(h) && cols.q === -1) cols.q = i;
	});
	return cols;
}

function parseCorrect(value, answers) {
	if (!value) return [];
	const parts = String(value)
		.split(/[;|,]/)
		.map((p) => p.trim())
		.filter(Boolean);
	const out = new Set();
	for (const p of parts) {
		if (/^\d+$/.test(p)) {
			const n = Number(p) - 1;
			if (n >= 0 && n < answers.length) out.add(n);
		} else if (/^[a-f]$/i.test(p)) {
			const n = p.toUpperCase().charCodeAt(0) - 65;
			if (n < answers.length) out.add(n);
		} else {
			const n = answers.findIndex((a) => a.toLowerCase() === p.toLowerCase());
			if (n >= 0) out.add(n);
		}
	}
	return [...out].sort();
}

/** Returns { questions, errors } */
export function csvToQuestions(text, defaultTime = 20) {
	const rows = parseCSV(text);
	const errors = [];
	const questions = [];
	let start = 0;
	let cols = { q: 0, answers: [1, 2, 3, 4], correct: 5, time: 6 };
	const h = findHeader(rows);
	if (h >= 0) {
		const mapped = mapColumns(rows[h]);
		if (mapped.q >= 0 && mapped.answers.length >= 2) cols = mapped;
		start = h + 1;
	}
	for (let r = start; r < rows.length; r++) {
		const row = rows[r];
		const line = r + 1;
		const text = (row[cols.q] || '').trim();
		if (!text) continue;
		// keep answer positions so "Correct = 3" still points at column 3
		const slots = cols.answers.map((i) => (row[i] || '').trim()).slice(0, 6);
		const answers = [];
		const slotToAnswer = {};
		slots.forEach((a, i) => {
			if (a) {
				slotToAnswer[i] = answers.length;
				answers.push(a);
			}
		});
		if (answers.length < 2) {
			errors.push(`Row ${line}: needs at least 2 answers`);
			continue;
		}
		const raw = parseCorrect(row[cols.correct], slots.map((s) => s || '\u0000'));
		const correct = raw.map((i) => slotToAnswer[i]).filter((i) => i !== undefined);
		if (!correct.length) {
			errors.push(`Row ${line}: couldn't tell which answer is correct`);
			continue;
		}
		let time = parseInt(row[cols.time], 10);
		if (!Number.isFinite(time) || time <= 0) time = defaultTime;
		time = Math.max(5, Math.min(300, time));
		questions.push({ text: text.slice(0, 500), answers: answers.map((a) => a.slice(0, 200)), correct, time });
	}
	if (!questions.length && !errors.length) errors.push('No questions found in this file');
	return { questions, errors };
}

/** Server-side guard for question arrays sent by hosts. */
export function sanitizeQuestions(input) {
	if (!Array.isArray(input)) return [];
	return input
		.slice(0, 500)
		.map((q) => {
			const answers = (Array.isArray(q?.answers) ? q.answers : [])
				.map((a) => String(a ?? '').slice(0, 200).trim())
				.filter(Boolean)
				.slice(0, 6);
			const correct = (Array.isArray(q?.correct) ? q.correct : [])
				.map(Number)
				.filter((i) => Number.isInteger(i) && i >= 0 && i < answers.length);
			const time = Math.max(5, Math.min(300, Number(q?.time) || 20));
			return { text: String(q?.text ?? '').slice(0, 500).trim(), answers, correct: [...new Set(correct)], time };
		})
		.filter((q) => q.text && q.answers.length >= 2 && q.correct.length);
}

export const SAMPLE_CSV = `Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer,Time Limit
Which animal is the largest mammal on Earth?,Elephant,Blue whale,Giraffe,Hippo,2,20
How many legs does a spider have?,6,8,10,12,2,15
What do pandas mostly eat?,Bamboo,Fish,Berries,Insects,1,15
Which planet is known as the Red Planet?,Venus,Jupiter,Mars,Saturn,3,20
What is 7 x 8?,54,56,58,64,2,15
"Which of these are mammals? (pick any)",Dolphin,Shark,Bat,Penguin,1;3,25
What is the capital of Japan?,Seoul,Beijing,Tokyo,Bangkok,3,15
Which gas do plants absorb from the air?,Oxygen,Carbon dioxide,Nitrogen,Helium,2,20
How many continents are there?,5,6,7,8,3,15
What is the fastest land animal?,Cheetah,Lion,Horse,Pronghorn,1,15
`;
