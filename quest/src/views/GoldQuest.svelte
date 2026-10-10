<script>
	import { onMount } from 'svelte';
	import { fly, scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { socket, call, syncClock } from '../lib/socket.js';
	import { clock, fmt } from '../lib/clock.svelte.js';
	import { sfx } from '../lib/sfx.js';
	import { coins, burst } from '../lib/confetti.js';
	import { toast } from '../lib/toast.svelte.js';
	import { rewardInfo } from '../lib/rewards.js';
	import AnswerGrid from '../lib/AnswerGrid.svelte';
	import AnimatedNumber from '../lib/AnimatedNumber.svelte';
	import Avatar from '../lib/Avatar.svelte';
	import Chest from '../lib/Chest.svelte';

	let { me = $bindable(), game = $bindable(), initial = null } = $props();

	let phase = $state('loading'); // loading | question | right | wrong | chests | opened | target | done
	let question = $state(null);
	let picked = $state([]);
	let correctAnswers = $state(null);
	let chests = $state(null);
	let pickedChest = $state(-1);
	let reward = $state(null);
	let delta = $state(0);
	let targets = $state([]);
	let targetResult = $state(null);
	let rank = $state(null);
	let total = $state(null);
	let hudBump = $state(false);
	let hudHit = $state(false);
	let busy = false;

	const timeLeft = $derived(game.endsAt ? game.endsAt - clock.now : null);
	const info = $derived(rewardInfo(reward));

	function setGold(g) {
		if (g > me.gold) {
			hudBump = true;
			setTimeout(() => (hudBump = false), 500);
		}
		me.gold = g;
	}

	async function refreshStanding() {
		const r = await call('gq:standing');
		if (!r?.error) {
			rank = r.rank;
			total = r.total;
		}
	}

	async function nextQuestion() {
		if (busy) return;
		busy = true;
		const r = await call('gq:next');
		busy = false;
		if (r?.error) return;
		question = r.question;
		picked = [];
		correctAnswers = null;
		chests = null;
		pickedChest = -1;
		reward = null;
		targetResult = null;
		targets = [];
		phase = 'question';
		refreshStanding();
	}

	async function answer(ans) {
		if (phase !== 'question' || busy) return;
		busy = true;
		picked = ans;
		const r = await call('gq:answer', { answer: ans });
		busy = false;
		if (r?.error) return nextQuestion();
		correctAnswers = r.correctAnswers;
		if (r.correct) {
			me.correct++;
			phase = 'right';
			sfx.correct();
			setTimeout(() => (phase = 'chests'), 900);
		} else {
			phase = 'wrong';
			sfx.wrong();
		}
	}

	async function pick(i) {
		if (phase !== 'chests' || busy) return;
		busy = true;
		pickedChest = i;
		sfx.chest();
		const r = await call('gq:pick', { chest: i });
		busy = false;
		if (r?.error) return nextQuestion();
		chests = r.chests;
		reward = r.reward;
		delta = r.delta;
		phase = 'opened';
		const tone = rewardInfo(r.reward).tone;
		setTimeout(() => {
			if (tone === 'bad') sfx.bad();
			else if (r.reward.type === 'nothing') sfx.wrong();
			else {
				sfx.coin();
				coins(0.5, 0.45);
			}
			if (r.reward.type === 'dragon') burst();
			setGold(r.gold);
		}, 350);
		if (r.targets) {
			targets = r.targets;
			setTimeout(() => (phase = 'target'), 1400);
		}
		refreshStanding();
	}

	async function chooseTarget(t) {
		if (busy) return;
		busy = true;
		sfx.click();
		const r = await call('gq:target', { playerId: t.id });
		busy = false;
		if (r?.error) return toast(r.error, { icon: '🙈', kind: 'bad' });
		targetResult = r;
		delta = r.delta;
		setGold(r.gold);
		sfx.coin();
		coins(0.5, 0.4);
		phase = 'done';
		refreshStanding();
	}

	function onHit(h) {
		const verb = h.kind === 'swap' ? 'swapped gold with you' : `took ${h.amount} gold from you`;
		toast(`${h.by.name} ${verb}!`, { icon: h.kind === 'swap' ? '🔄' : '🫳', kind: 'bad', ms: 4000 });
		sfx.bad();
		me.gold = h.gold;
		hudHit = true;
		setTimeout(() => (hudHit = false), 600);
		refreshStanding();
	}
	function onTime(t) {
		syncClock(t.serverNow);
		game.endsAt = t.endsAt;
		toast('The host added more time!', { icon: '⏰', kind: 'good' });
	}

	onMount(() => {
		socket.on('gq:hit', onHit);
		socket.on('game:time', onTime);
		// resume mid-chest/target after a refresh
		if (initial?.state === 'target' && initial.targets) {
			targets = initial.targets;
			reward = initial.pending;
			phase = 'target';
		} else if (initial?.state === 'question' && initial.question) {
			question = initial.question;
			phase = 'question';
		} else nextQuestion();
		refreshStanding();
		return () => {
			socket.off('gq:hit', onHit);
			socket.off('game:time', onTime);
		};
	});
</script>

<div class="gq" onkeydown={(e) => e.key === 'Enter' && (phase === 'wrong' || phase === 'done' || (phase === 'opened' && !targets.length)) && nextQuestion()} role="presentation">
	<header class="hud">
		<div class="me">
			<Avatar avatar={me.avatar} size={40} />
			<span class="nm">{me.name}</span>
		</div>
		<div class="gold" class:bump={hudBump} class:hit={hudHit}>
			<span class="coin">🪙</span>
			<AnimatedNumber value={me.gold} duration={900} />
		</div>
		<div class="right">
			{#if rank}<span class="pill">#{rank}<small>/{total}</small></span>{/if}
			{#if timeLeft !== null}<span class="pill" class:urgent={timeLeft < 30000}>⏱ {fmt(timeLeft)}</span>{/if}
		</div>
	</header>

	<div class="body">
		{#key phase === 'question' || phase === 'right' || phase === 'wrong' ? 'q' + question?.text : phase === 'opened' || phase === 'chests' ? 'chests' : phase}
			<div class="panel" in:fly={{ y: 40, duration: 450, easing: backOut }} out:fade={{ duration: 120 }}>
				{#if phase === 'loading'}
					<div class="loading">🪙</div>
				{:else if phase === 'question' || phase === 'right' || phase === 'wrong'}
					<div class="qcard card" class:right={phase === 'right'} class:wrong={phase === 'wrong'}>
						<h2>{question.text}</h2>
					</div>
					<AnswerGrid
						answers={question.answers}
						multi={question.multi}
						disabled={phase !== 'question'}
						reveal={phase === 'wrong' || phase === 'right' ? correctAnswers : null}
						{picked}
						onanswer={answer}
					/>
					{#if phase === 'right'}
						<div class="banner good" in:scale={{ start: 0.3, duration: 400, easing: backOut }}>✨ Correct! ✨</div>
					{:else if phase === 'wrong'}
						<div class="wrongbox" in:fly={{ y: 20, duration: 300 }}>
							<div class="banner bad">😬 Not quite!</div>
							<button class="btn big white" onclick={nextQuestion}>Next question ➜</button>
						</div>
					{/if}
				{:else if phase === 'chests' || phase === 'opened'}
					<h2 class="white-text title">{phase === 'chests' ? 'Choose a chest!' : info.title}</h2>
					<div class="chests">
						{#each [0, 1, 2] as i}
							<Chest
								state={phase === 'chests' ? (pickedChest === i ? 'open' : 'closed') : pickedChest === i ? 'open' : 'other'}
								reward={chests?.[i]}
								delay={i * 120}
								disabled={pickedChest >= 0}
								onpick={() => pick(i)}
							/>
						{/each}
					</div>
					{#if phase === 'opened'}
						<div class="after" in:fly={{ y: 20, duration: 400, delay: 600 }}>
							{#if reward?.type === 'take' || reward?.type === 'swap'}
								<p class="white-text hint">Pick a player…</p>
							{:else}
								<div class="delta" class:neg={delta < 0} class:zero={delta === 0}>{delta > 0 ? '+' : ''}{delta.toLocaleString()} gold</div>
								<button class="btn big" onclick={nextQuestion}>Next question ➜</button>
							{/if}
						</div>
					{/if}
				{:else if phase === 'target'}
					<h2 class="white-text title">{reward?.type === 'swap' ? '🔄 Swap gold with…' : `🫳 Take ${reward?.pct}% from…`}</h2>
					<ul class="targets">
						{#each targets as t, i (t.id)}
							<li in:fly={{ x: 40, duration: 350, delay: i * 50 }}>
								<button class="target" onclick={() => chooseTarget(t)}>
									<Avatar avatar={t.avatar} size={46} />
									<span class="tn">{t.name}</span>
									<span class="tg">🪙 {t.gold.toLocaleString()}</span>
									{#if reward?.type === 'take'}<span class="gain">+{Math.round((t.gold * reward.pct) / 100).toLocaleString()}</span>{/if}
								</button>
							</li>
						{/each}
					</ul>
				{:else if phase === 'done'}
					<div class="donecard card" in:scale={{ start: 0.5, duration: 500, easing: backOut }}>
						<div class="duo">
							<Avatar avatar={me.avatar} size={80} bob />
							<span class="vs">{targetResult.kind === 'swap' ? '🔄' : '🫳'}</span>
							<Avatar avatar={targetResult.target.avatar} size={80} />
						</div>
						<h2>
							{#if targetResult.kind === 'swap'}
								You swapped with {targetResult.target.name}!
							{:else}
								You took {targetResult.amount.toLocaleString()} gold from {targetResult.target.name}!
							{/if}
						</h2>
						<div class="delta" class:neg={delta < 0}>{delta >= 0 ? '+' : ''}{delta.toLocaleString()} gold</div>
						<button class="btn big purple" onclick={nextQuestion}>Next question ➜</button>
					</div>
				{/if}
			</div>
		{/key}
	</div>
</div>

<style>
	.gq {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		outline: none;
	}
	.hud {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 10px 14px;
		background: rgba(0, 0, 0, 0.18);
		backdrop-filter: blur(10px);
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.me {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #fff;
		font-weight: 600;
		min-width: 0;
	}
	.nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.gold {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fff;
		padding: 6px 22px;
		border-radius: 999px;
		font-size: 1.7rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		box-shadow: 0 5px 0 var(--gold-dark), 0 0 0 4px var(--gold);
		transition: transform 0.3s var(--spring);
	}
	.gold.bump {
		transform: scale(1.18);
	}
	.gold.hit {
		animation: shake 0.45s;
		box-shadow: 0 5px 0 var(--bad-dark), 0 0 0 4px var(--bad);
	}
	.coin {
		display: inline-block;
	}
	.gold.bump .coin {
		animation: spin 0.5s ease-out;
	}
	.right {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.pill small {
		opacity: 0.7;
	}
	.pill.urgent {
		background: var(--bad);
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
		align-items: center;
	}
	.loading {
		margin-top: 30vh;
		font-size: 3rem;
		animation: spin 1s linear infinite;
	}
	.qcard {
		width: 100%;
		text-align: center;
		padding: 28px 20px;
		transition: box-shadow 0.3s, transform 0.3s var(--spring);
	}
	.qcard h2 {
		font-size: clamp(1.3rem, 4vw, 2rem);
	}
	.qcard.right {
		box-shadow: 0 8px 0 var(--good-dark), 0 0 0 5px var(--good);
	}
	.qcard.wrong {
		box-shadow: 0 8px 0 var(--bad-dark), 0 0 0 5px var(--bad);
	}
	.banner {
		font-size: 2rem;
		font-weight: 700;
		padding: 10px 30px;
		border-radius: 20px;
		color: #fff;
		text-shadow: 0 3px 0 rgba(0, 0, 0, 0.2);
	}
	.banner.good {
		background: var(--good);
		box-shadow: 0 6px 0 var(--good-dark);
	}
	.banner.bad {
		background: var(--bad);
		box-shadow: 0 6px 0 var(--bad-dark);
	}
	.wrongbox {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.title {
		font-size: clamp(1.8rem, 6vw, 2.8rem);
		text-align: center;
		margin-top: 4vh;
	}
	.chests {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: clamp(8px, 3vw, 30px);
		width: min(720px, 100%);
		margin-top: 10px;
	}
	.after {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.hint {
		font-size: 1.3rem;
	}
	.delta {
		font-size: 2.2rem;
		font-weight: 700;
		color: #fff;
		background: var(--good);
		padding: 4px 24px;
		border-radius: 999px;
		box-shadow: 0 5px 0 var(--good-dark);
	}
	.delta.zero {
		background: #a6a0bf;
		box-shadow: 0 5px 0 #7d7799;
	}
	.delta.neg {
		background: var(--bad);
		box-shadow: 0 5px 0 var(--bad-dark);
	}
	.targets {
		list-style: none;
		padding: 0;
		margin: 0;
		width: min(560px, 100%);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.target {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		padding: 10px 16px 10px 10px;
		border-radius: 18px;
		box-shadow: 0 5px 0 #d6ccf5;
		font-weight: 600;
		font-size: 1.1rem;
		transition: transform 0.2s var(--spring), box-shadow 0.2s;
	}
	.target:hover {
		transform: translateX(6px) scale(1.02);
		box-shadow: 0 5px 0 #7c5cff;
	}
	.target:active {
		transform: scale(0.97);
	}
	.tn {
		flex: 1;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tg {
		font-variant-numeric: tabular-nums;
	}
	.gain {
		background: var(--good);
		color: #fff;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 0.9rem;
	}
	.donecard {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		margin-top: 6vh;
		width: min(520px, 100%);
	}
	.duo {
		display: flex;
		align-items: center;
		gap: 20px;
	}
	.vs {
		font-size: 2.4rem;
		animation: wiggle 0.8s ease-in-out infinite;
	}
	@media (max-width: 560px) {
		.nm {
			display: none;
		}
		.gold {
			font-size: 1.35rem;
			padding: 4px 16px;
		}
	}
</style>
