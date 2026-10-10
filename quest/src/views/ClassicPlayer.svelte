<script>
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { socket, call, syncClock } from '../lib/socket.js';
	import { clock } from '../lib/clock.svelte.js';
	import { sfx } from '../lib/sfx.js';
	import { burst } from '../lib/confetti.js';
	import AnswerGrid from '../lib/AnswerGrid.svelte';
	import AnimatedNumber from '../lib/AnimatedNumber.svelte';
	import Avatar from '../lib/Avatar.svelte';
	import Ring from '../lib/Ring.svelte';

	let { me = $bindable(), initial = null } = $props();

	let phase = $state('waiting'); // waiting | question | answered | result | leaderboard
	let q = $state(null);
	let picked = $state([]);
	let result = $state(null);
	const waitingLines = ['Thinking hard… 🤔', 'Fingers crossed 🤞', 'Waiting for the others 🐢', 'Nice speed! ⚡'];
	let line = $state(waitingLines[0]);

	const countdown = $derived(q ? Math.min(3, Math.ceil((q.startsAt - clock.now) / 1000)) : 0);
	const ready = $derived(phase === 'question' && countdown > 0);

	function onQuestion(data) {
		syncClock(data.serverNow);
		q = data;
		picked = [];
		result = null;
		phase = 'question';
		sfx.pop();
	}
	function onResult(r) {
		result = r;
		me.score = r.score;
		phase = 'result';
		if (r.correct) {
			sfx.correct();
			burst({ particleCount: 60 });
		} else sfx.wrong();
	}
	function onLeaderboard() {
		phase = 'leaderboard';
	}

	async function answer(ans) {
		if (phase !== 'question' || ready) return;
		picked = ans;
		phase = 'answered';
		line = waitingLines[Math.floor(Math.random() * waitingLines.length)];
		const r = await call('classic:answer', { answer: ans });
		if (r?.error === 'not-yet') phase = 'question';
	}

	onMount(() => {
		socket.on('classic:question', onQuestion);
		socket.on('classic:result', onResult);
		socket.on('classic:leaderboard', onLeaderboard);
		if (initial?.question) {
			onQuestion(initial.question);
			if (initial.answered) phase = 'answered';
		} else if (initial?.phase === 'reveal' || initial?.phase === 'leaderboard') phase = 'leaderboard';
		return () => {
			socket.off('classic:question', onQuestion);
			socket.off('classic:result', onResult);
			socket.off('classic:leaderboard', onLeaderboard);
		};
	});
</script>

<div class="cl">
	<header class="hud">
		<div class="me"><Avatar avatar={me.avatar} size={40} /><span>{me.name}</span></div>
		{#if q}<span class="pill">Q {q.index + 1}/{q.total}</span>{/if}
		<div class="score">⭐ <AnimatedNumber value={me.score} /></div>
	</header>

	<div class="body">
		{#key phase + (q?.index ?? '') + (ready ? 'r' : '')}
			<div class="panel" in:fly={{ y: 40, duration: 450, easing: backOut }}>
				{#if phase === 'waiting'}
					<div class="center">
						<Avatar avatar={me.avatar} size={110} bob />
						<h2 class="white-text">Get ready!</h2>
						<p class="white-text sub">The first question is coming…</p>
					</div>
				{:else if ready}
					<div class="center">
						<p class="white-text sub">Question {q.index + 1}</p>
						{#key countdown}<span class="cd" in:scale={{ start: 2.2, duration: 450 }}>{countdown}</span>{/key}
					</div>
				{:else if phase === 'question'}
					<div class="qrow">
						<div class="qcard card"><h2>{q.text}</h2></div>
						<Ring startsAt={q.startsAt} time={q.time} size={76} />
					</div>
					<AnswerGrid answers={q.answers} multi={q.multi} {picked} onanswer={answer} big />
				{:else if phase === 'answered'}
					<div class="center">
						<div class="spinner">🪙</div>
						<h2 class="white-text">{line}</h2>
					</div>
				{:else if phase === 'result'}
					<div class="center res" class:good={result.correct}>
						<div class="big" in:scale={{ start: 0.2, duration: 500, easing: backOut }}>{result.correct ? '🎉' : result.answered ? '😵' : '⏰'}</div>
						<h1 class="white-text">{result.correct ? 'Correct!' : result.answered ? 'Incorrect' : "Time's up!"}</h1>
						{#if result.correct}
							<div class="pts">+{result.points}</div>
							{#if result.streak > 1}<span class="pill">🔥 Streak {result.streak}</span>{/if}
						{:else}
							<p class="white-text sub">Answer: <b>{result.correctAnswers.map((i) => result.answers[i]).join(', ')}</b></p>
						{/if}
						<p class="white-text rank">You're <b>#{result.rank}</b> of {result.total}</p>
					</div>
				{:else if phase === 'leaderboard'}
					<div class="center">
						<Avatar avatar={me.avatar} size={90} bob />
						<h2 class="white-text">⭐ {me.score.toLocaleString()} points</h2>
						<p class="white-text sub">Eyes on the big screen! 👀</p>
					</div>
				{/if}
			</div>
		{/key}
	</div>
</div>

<style>
	.cl {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.hud {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		background: rgba(0, 0, 0, 0.18);
		backdrop-filter: blur(10px);
		color: #fff;
		font-weight: 600;
	}
	.me {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.score {
		background: #fff;
		color: var(--ink);
		padding: 4px 16px;
		border-radius: 999px;
		font-size: 1.3rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.body {
		flex: 1;
		display: grid;
		padding: 18px 16px 30px;
	}
	.panel {
		grid-area: 1 / 1;
		width: min(900px, 100%);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		margin-top: 14vh;
		text-align: center;
	}
	.sub {
		font-size: 1.2rem;
		margin: 0;
	}
	.cd {
		font-size: 9rem;
		font-weight: 700;
		color: #fff;
		line-height: 1;
		text-shadow: 0 8px 0 rgba(0, 0, 0, 0.15);
	}
	.qrow {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.qcard {
		flex: 1;
		text-align: center;
		padding: 22px;
	}
	.qcard h2 {
		font-size: clamp(1.2rem, 4vw, 1.8rem);
	}
	.spinner {
		font-size: 3.4rem;
		animation: spin 1.2s linear infinite;
	}
	.big {
		font-size: 6rem;
	}
	.res h1 {
		font-size: 3rem;
	}
	.pts {
		font-size: 2.6rem;
		font-weight: 700;
		background: #fff;
		padding: 4px 28px;
		border-radius: 999px;
		box-shadow: 0 6px 0 var(--good-dark), 0 0 0 4px var(--good);
		animation: pop-in 0.5s var(--spring) 0.2s both;
	}
	.rank {
		font-size: 1.3rem;
	}
</style>
