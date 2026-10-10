<script>
	import { fly, slide, scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { navigate } from '../lib/router.svelte.js';
	import { call } from '../lib/socket.js';
	import { csvToQuestions, SAMPLE_CSV } from '../lib/csv.js';
	import { sfx } from '../lib/sfx.js';
	import { toast } from '../lib/toast.svelte.js';

	const load = (k, d) => {
		try {
			return JSON.parse(localStorage.getItem(k)) ?? d;
		} catch {
			return d;
		}
	};
	const saved = load('qq-set', null);

	let title = $state(saved?.title ?? '');
	let questions = $state(saved?.questions ?? []);
	let errors = $state([]);
	let fileName = $state(saved?.fileName ?? '');
	let dragging = $state(false);
	let mode = $state(load('qq-mode', 'gold'));
	let endBy = $state('time');
	let minutes = $state(7);
	let goal = $state(5000);
	let shuffle = $state(true);
	let timeOverride = $state(0);
	let busy = $state(false);
	let showAll = $state(false);
	let input;

	$effect(() => {
		try {
			localStorage.setItem('qq-set', JSON.stringify({ title, questions, fileName }));
			localStorage.setItem('qq-mode', JSON.stringify(mode));
		} catch {}
	});

	function ingest(text, name) {
		const r = csvToQuestions(text);
		errors = r.errors;
		if (!r.questions.length) {
			sfx.wrong();
			toast(r.errors[0] || 'No questions found', { icon: '😵', kind: 'bad' });
			return;
		}
		questions = r.questions;
		fileName = name;
		if (!title) title = name.replace(/\.(csv|txt)$/i, '').replace(/[-_]+/g, ' ');
		sfx.correct();
		toast(`Loaded ${r.questions.length} questions`, { icon: '📚', kind: 'good' });
	}

	async function onFiles(files) {
		const f = files?.[0];
		if (!f) return;
		if (f.size > 2_000_000) return toast('That file is too big (2 MB max)', { icon: '🐘', kind: 'bad' });
		ingest(await f.text(), f.name);
	}

	function useSample() {
		title = 'Animal & World Trivia';
		ingest(SAMPLE_CSV, 'sample-quiz.csv');
	}

	function downloadTemplate() {
		const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'quizquest-template.csv';
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	function removeQ(i) {
		questions = questions.filter((_, j) => j !== i);
		sfx.pop();
	}

	async function host() {
		if (!questions.length) return toast('Upload a quiz first', { icon: '📄', kind: 'bad' });
		busy = true;
		const r = await call('host:create', {
			questions,
			title: title || 'Quiz',
			mode,
			settings: { endBy, minutes, goal, shuffle, timeOverride: timeOverride || null }
		});
		busy = false;
		if (r?.error) return toast(r.error, { icon: '😵', kind: 'bad' });
		try { localStorage.setItem(`qq-host-${r.pin}`, r.hostToken); } catch {};
		sfx.join();
		navigate(`/host/live?pin=${r.pin}`);
	}

	const modes = [
		{ id: 'gold', icon: '🪙', name: 'Gold Quest', blurb: 'Answer to open chests. Steal, swap & dodge dragons. Most gold wins!', tags: ['Self-paced', 'Luck & speed'] },
		{ id: 'classic', icon: '⚡', name: 'Classic', blurb: 'Everyone answers together. Faster correct answers score more points.', tags: ['Host-paced', 'Speed'] }
	];
</script>

<div class="wrap">
	<header>
		<button class="btn ghost sm" onclick={() => navigate('/')}>← Home</button>
		<h1 class="white-text">Host a game</h1>
		<span></span>
	</header>

	<section class="card step" in:fly={{ y: 30, duration: 500 }}>
		<h2><span class="num">1</span> Your quiz</h2>
		<input class="input title" placeholder="Name your quiz" bind:value={title} maxlength="80" />

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="drop"
			class:dragging
			class:has={questions.length}
			role="button"
			tabindex="0"
			onclick={() => input.click()}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && input.click()}
			ondragenter={(e) => (e.preventDefault(), (dragging = true))}
			ondragover={(e) => e.preventDefault()}
			ondragleave={() => (dragging = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragging = false;
				onFiles(e.dataTransfer.files);
			}}
		>
			<input bind:this={input} type="file" accept=".csv,text/csv,.txt" hidden onchange={(e) => onFiles(e.currentTarget.files)} />
			<div class="drop-icon">{dragging ? '😮' : questions.length ? '✅' : '📄'}</div>
			{#if questions.length}
				<strong>{fileName || 'Quiz loaded'}</strong>
				<span>{questions.length} questions ready · click or drop to replace</span>
			{:else}
				<strong>Drop your CSV here</strong>
				<span>or click to browse</span>
			{/if}
		</div>

		<div class="row">
			<button class="btn sm white" onclick={useSample}>✨ Try a sample quiz</button>
			<button class="btn sm white" onclick={downloadTemplate}>⬇️ CSV template</button>
		</div>

		<details class="help">
			<summary>CSV format</summary>
			<p>One question per row. Columns: <b>Question, Answer 1, Answer 2, Answer 3, Answer 4, Correct Answer, Time Limit</b>.
				Correct answer can be a number (1-4), a letter (A-D) or the answer text. Use <code>1;3</code> for several correct answers.
				Blooket's spreadsheet template works too.</p>
		</details>

		{#if errors.length}
			<ul class="errors" transition:slide>
				{#each errors.slice(0, 5) as e}<li>⚠️ {e}</li>{/each}
				{#if errors.length > 5}<li>…and {errors.length - 5} more</li>{/if}
			</ul>
		{/if}

		{#if questions.length}
			<ol class="qs" transition:slide>
				{#each showAll ? questions : questions.slice(0, 4) as q, i (q)}
					<li animate:flip={{ duration: 300 }} in:fly={{ x: -20, duration: 300, delay: i * 40 }} out:scale={{ duration: 200 }}>
						<span class="qn">{i + 1}</span>
						<div class="qbody">
							<p>{q.text}</p>
							<div class="chips">
								{#each q.answers as a, j}<span class="chip" class:ok={q.correct.includes(j)}>{a}</span>{/each}
								<span class="time">⏱ {q.time}s</span>
							</div>
						</div>
						<button class="x" title="Remove question" onclick={() => removeQ(i)}>✕</button>
					</li>
				{/each}
			</ol>
			{#if questions.length > 4}
				<button class="more" onclick={() => (showAll = !showAll)}>{showAll ? 'Show less ▲' : `Show all ${questions.length} ▼`}</button>
			{/if}
		{/if}
	</section>

	<section class="card step" in:fly={{ y: 30, duration: 500, delay: 100 }}>
		<h2><span class="num">2</span> Game mode</h2>
		<div class="modes">
			{#each modes as m}
				<button class="mode" class:on={mode === m.id} onclick={() => ((mode = m.id), sfx.click())}>
					{#if m.id === 'gold'}<span class="badge">Default</span>{/if}
					<span class="micon">{m.icon}</span>
					<strong>{m.name}</strong>
					<span class="blurb">{m.blurb}</span>
					<span class="tags">{#each m.tags as t}<em>{t}</em>{/each}</span>
				</button>
			{/each}
		</div>

		{#key mode}
			<div class="settings" in:fly={{ y: 10, duration: 300 }}>
				{#if mode === 'gold'}
					<div class="field">
						<span class="label">Game ends by</span>
						<div class="seg">
							<button class:on={endBy === 'time'} onclick={() => (endBy = 'time')}>⏱ Time limit</button>
							<button class:on={endBy === 'goal'} onclick={() => (endBy = 'goal')}>🎯 Gold goal</button>
						</div>
					</div>
					{#if endBy === 'time'}
						<div class="field">
							<span class="label">Minutes</span>
							<div class="seg">{#each [3, 5, 7, 10, 15] as m}<button class:on={minutes === m} onclick={() => (minutes = m)}>{m}</button>{/each}</div>
						</div>
					{:else}
						<div class="field">
							<span class="label">First to</span>
							<div class="seg">{#each [1000, 2500, 5000, 10000, 25000] as g}<button class:on={goal === g} onclick={() => (goal = g)}>{g.toLocaleString()}</button>{/each}</div>
						</div>
					{/if}
					<label class="toggle"><input type="checkbox" bind:checked={shuffle} /><span></span> Shuffle question order</label>
				{:else}
					<div class="field">
						<span class="label">Time per question</span>
						<div class="seg">
							{#each [[0, 'From CSV'], [10, '10s'], [20, '20s'], [30, '30s'], [60, '60s']] as [v, l]}<button class:on={timeOverride === v} onclick={() => (timeOverride = v)}>{l}</button>{/each}
						</div>
					</div>
				{/if}
			</div>
		{/key}
	</section>

	<div class="go" in:fly={{ y: 30, duration: 500, delay: 200 }}>
		<button class="btn big green" disabled={busy || !questions.length} onclick={host}>
			{busy ? 'Creating…' : 'Host now 🚀'}
		</button>
	</div>
</div>

<style>
	.wrap {
		max-width: 820px;
		margin: 0 auto;
		padding: 20px 16px 80px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
	}
	header h1 {
		font-size: 2rem;
	}
	h2 {
		font-size: 1.4rem;
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.num {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: #7c5cff;
		color: #fff;
		display: grid;
		place-items: center;
		font-size: 1.1rem;
	}
	.title {
		margin-bottom: 14px;
	}
	.drop {
		border: 3px dashed #c9bbf7;
		border-radius: 20px;
		padding: 30px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		background: var(--card-2);
		transition: all 0.25s var(--spring);
		color: var(--ink-soft);
		text-align: center;
	}
	.drop strong {
		color: var(--ink);
		font-size: 1.2rem;
	}
	.drop:hover,
	.drop.dragging {
		border-color: #7c5cff;
		background: #ebe4ff;
		transform: scale(1.015);
	}
	.drop.dragging {
		transform: scale(1.04) rotate(-0.5deg);
	}
	.drop.has {
		border-style: solid;
		border-color: var(--good);
		background: #eefcf3;
	}
	.drop-icon {
		font-size: 2.8rem;
		transition: transform 0.3s var(--spring);
	}
	.drop:hover .drop-icon {
		transform: translateY(-6px) rotate(-8deg) scale(1.1);
	}
	.row {
		display: flex;
		gap: 10px;
		margin-top: 14px;
		flex-wrap: wrap;
	}
	.help {
		margin-top: 14px;
		color: var(--ink-soft);
	}
	.help summary {
		cursor: pointer;
		font-weight: 600;
	}
	.help p {
		margin: 8px 0 0;
		line-height: 1.5;
	}
	.errors {
		margin: 14px 0 0;
		padding: 10px 14px;
		list-style: none;
		background: #fff4e0;
		border-radius: 14px;
		color: #8a5a00;
	}
	.qs {
		list-style: none;
		padding: 0;
		margin: 16px 0 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.qs li {
		display: flex;
		gap: 12px;
		padding: 12px;
		background: var(--card-2);
		border-radius: 16px;
		align-items: flex-start;
	}
	.qn {
		width: 30px;
		height: 30px;
		border-radius: 10px;
		background: #fff;
		display: grid;
		place-items: center;
		font-weight: 700;
		flex: none;
	}
	.qbody {
		flex: 1;
		min-width: 0;
	}
	.qbody p {
		margin: 3px 0 8px;
		font-weight: 600;
	}
	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.chip {
		padding: 2px 10px;
		border-radius: 999px;
		background: #fff;
		font-size: 0.9rem;
	}
	.chip.ok {
		background: var(--good);
		color: #fff;
	}
	.time {
		font-size: 0.85rem;
		color: var(--ink-soft);
		align-self: center;
	}
	.x {
		color: var(--ink-soft);
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}
	.x:hover {
		background: #ffe0e4;
		color: var(--bad);
	}
	.more {
		margin-top: 10px;
		color: #7c5cff;
		font-weight: 600;
	}
	.modes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.mode {
		position: relative;
		text-align: left;
		padding: 18px;
		border-radius: 20px;
		background: var(--card-2);
		border: 3px solid transparent;
		display: flex;
		flex-direction: column;
		gap: 6px;
		transition: all 0.25s var(--spring);
	}
	.mode:hover {
		transform: translateY(-3px);
	}
	.mode.on {
		border-color: #7c5cff;
		background: #fff;
		box-shadow: 0 6px 0 #d6ccf5, 0 0 0 6px rgba(124, 92, 255, 0.15);
		transform: translateY(-3px) scale(1.02);
	}
	.micon {
		font-size: 2.4rem;
		transition: transform 0.4s var(--spring);
	}
	.mode.on .micon {
		transform: rotate(-10deg) scale(1.15);
		animation: wiggle 1.6s ease-in-out 0.4s infinite;
	}
	.mode strong {
		font-size: 1.3rem;
	}
	.blurb {
		color: var(--ink-soft);
		line-height: 1.35;
	}
	.tags {
		display: flex;
		gap: 6px;
		margin-top: 4px;
	}
	.tags em {
		font-style: normal;
		font-size: 0.8rem;
		padding: 2px 8px;
		border-radius: 999px;
		background: #e6defc;
		color: #5b3cc4;
		font-weight: 600;
	}
	.badge {
		position: absolute;
		top: 12px;
		right: 12px;
		background: var(--gold);
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.settings {
		margin-top: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.label {
		font-weight: 600;
		min-width: 130px;
	}
	.seg {
		display: inline-flex;
		background: var(--card-2);
		border-radius: 14px;
		padding: 4px;
		gap: 2px;
		flex-wrap: wrap;
	}
	.seg button {
		padding: 7px 14px;
		border-radius: 10px;
		font-weight: 600;
		color: var(--ink-soft);
		transition: all 0.2s var(--spring);
	}
	.seg button:hover {
		color: var(--ink);
	}
	.seg button.on {
		background: #7c5cff;
		color: #fff;
		box-shadow: 0 3px 0 #4b2fc4;
		transform: scale(1.04);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		cursor: pointer;
	}
	.toggle input {
		display: none;
	}
	.toggle span {
		width: 50px;
		height: 28px;
		border-radius: 999px;
		background: #d6ccf5;
		position: relative;
		transition: background 0.2s;
	}
	.toggle span::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.3s var(--spring);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	.toggle input:checked + span {
		background: var(--good);
	}
	.toggle input:checked + span::after {
		transform: translateX(22px);
	}
	.go {
		display: flex;
		justify-content: center;
	}
	.go .btn {
		min-width: 260px;
	}
	@media (max-width: 600px) {
		.modes {
			grid-template-columns: 1fr;
		}
		header h1 {
			font-size: 1.5rem;
		}
	}
</style>
