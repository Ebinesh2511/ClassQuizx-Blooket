<script>
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { route, navigate } from '../lib/router.svelte.js';
	import { socket, call, syncClock } from '../lib/socket.js';
	import { sfx } from '../lib/sfx.js';
	import { celebrate } from '../lib/confetti.js';
	import { toast } from '../lib/toast.svelte.js';
	import { randomAvatar, randomName } from '../lib/avatars.js';
	import Avatar from '../lib/Avatar.svelte';
	import AvatarPicker from '../lib/AvatarPicker.svelte';
	import AnimatedNumber from '../lib/AnimatedNumber.svelte';
	import GoldQuest from './GoldQuest.svelte';
	import ClassicPlayer from './ClassicPlayer.svelte';

	const pin = (route.query.get('pin') ?? '').replace(/\D/g, '');
	const tokenKey = `qq-player-${pin}`;
	const store = {
		get: (k) => {
			try {
				return localStorage.getItem(k);
			} catch {
				return null;
			}
		},
		set: (k, v) => {
			try {
				localStorage.setItem(k, v);
			} catch {}
		},
		del: (k) => {
			try {
				localStorage.removeItem(k);
			} catch {}
		}
	};

	let stage = $state('loading'); // loading | profile | lobby | playing | ended | kicked | error
	let errorMsg = $state('');
	let game = $state(null);
	let me = $state(null);
	let initialGq = $state(null);
	let initialClassic = $state(null);
	let end = $state(null);
	let othersHint = $state(0);

	let avatar = $state(randomAvatar());
	let name = $state('');
	let joining = $state(false);
	let shake = $state(false);
	let nameErr = $state('');

	function apply(snap) {
		syncClock(snap.game.serverNow);
		game = snap.game;
		me = snap.me;
		store.set(tokenKey, snap.token);
		initialGq = snap.gq ?? null;
		initialClassic = snap.classic ?? null;
		othersHint = snap.total;
		if (snap.end) return showEnd(snap.end);
		stage = game.status === 'lobby' ? 'lobby' : 'playing';
	}

	async function resume() {
		const token = store.get(tokenKey);
		if (!token) return false;
		const r = await call('player:resume', { pin, token });
		if (r?.error) {
			store.del(tokenKey);
			return false;
		}
		apply(r);
		return true;
	}

	async function boot() {
		if (!pin) return navigate('/', true);
		if (await resume()) return;
		const r = await call('player:check', { pin });
		if (r?.error) {
			errorMsg = r.error;
			stage = 'error';
			return;
		}
		stage = 'profile';
	}

	async function join(e) {
		e?.preventDefault();
		if (!name.trim()) return fail('Pick a nickname (or roll one 🎲)');
		joining = true;
		const r = await call('player:join', { pin, name, avatar });
		joining = false;
		if (r?.error) return fail(r.error);
		sfx.join();
		apply(r);
	}
	function fail(m) {
		nameErr = m;
		sfx.wrong();
		shake = true;
		setTimeout(() => (shake = false), 450);
	}

	function rollName() {
		name = randomName(avatar);
		nameErr = '';
		sfx.pop();
	}

	async function changeAvatar(a) {
		const r = await call('player:avatar', { avatar: a });
		if (r?.avatar) me.avatar = r.avatar;
	}

	function showEnd(e) {
		end = e;
		me = e.me;
		stage = 'ended';
		if (e.rank <= 3) setTimeout(() => celebrate(2500), 600);
		setTimeout(() => sfx.fanfare(), 400);
	}

	onMount(() => {
		const onStarted = (g) => {
			syncClock(g.serverNow);
			game = g;
			stage = 'playing';
			sfx.correct();
		};
		const onEnd = (e) => showEnd(e);
		const onKicked = () => {
			store.del(tokenKey);
			stage = 'kicked';
			sfx.bad();
		};
		const onReplaced = () => toast('You opened this game in another tab', { icon: '👯' });
		const onReconnect = async () => {
			if (stage === 'lobby' || stage === 'playing') {
				if (!(await resume())) {
					errorMsg = 'Lost connection to the game';
					stage = 'error';
				}
			}
		};
		socket.on('game:started', onStarted);
		socket.on('game:end', onEnd);
		socket.on('player:kicked', onKicked);
		socket.on('player:replaced', onReplaced);
		socket.io.on('reconnect', onReconnect);
		if (socket.connected) boot();
		else socket.once('connect', boot);
		return () => {
			socket.off('game:started', onStarted);
			socket.off('game:end', onEnd);
			socket.off('player:kicked', onKicked);
			socket.off('player:replaced', onReplaced);
			socket.io.off('reconnect', onReconnect);
		};
	});

	const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10] ?? 'th');
</script>

{#if stage === 'loading'}
	<div class="center"><div class="spin">🪙</div></div>
{:else if stage === 'error' || stage === 'kicked'}
	<div class="center">
		<div class="card msg" in:scale={{ start: 0.6, easing: backOut }}>
			<div class="emoji">{stage === 'kicked' ? '👢' : '🙈'}</div>
			<h2>{stage === 'kicked' ? 'You were removed from the game' : errorMsg}</h2>
			<button class="btn purple" onclick={() => navigate('/')}>Back home</button>
		</div>
	</div>
{:else if stage === 'profile'}
	<div class="center">
		<form class="card profile" class:shake onsubmit={join} in:fly={{ y: 40, duration: 500, easing: backOut }}>
			<span class="pill dark">Game {pin.slice(0, 3)} {pin.slice(3)}</span>
			<h2>Make your critter</h2>
			<AvatarPicker bind:avatar />
			<div class="namerow">
				<input class="input" placeholder="Nickname" maxlength="24" bind:value={name} oninput={() => (nameErr = '')} />
				<button type="button" class="btn white roll" title="Random name" onclick={rollName}>🎲</button>
			</div>
			{#if nameErr}<p class="err" in:fly={{ y: -6 }}>{nameErr}</p>{/if}
			<button class="btn big green" disabled={joining}>{joining ? 'Joining…' : "Let's go! 🚀"}</button>
		</form>
	</div>
{:else if stage === 'lobby'}
	<div class="center lobby">
		<div in:scale={{ start: 0.3, duration: 600, easing: backOut }}>
			<Avatar avatar={me.avatar} size={150} bob />
		</div>
		<h1 class="white-text">{me.name}</h1>
		<p class="white-text sub">You're in! See your name on the host's screen?</p>
		<div class="pill">{game.mode === 'gold' ? '🪙 Gold Quest' : '⚡ Classic'} · {game.title}</div>
		<div class="waitdots"><span></span><span></span><span></span></div>
		<details class="restyle">
			<summary class="btn ghost sm">🎨 Change look</summary>
			<div class="card mini"><AvatarPicker bind:avatar={me.avatar} onchange={changeAvatar} /></div>
		</details>
	</div>
{:else if stage === 'playing'}
	{#if game.mode === 'gold'}
		<GoldQuest bind:me bind:game initial={initialGq} />
	{:else}
		<ClassicPlayer bind:me initial={initialClassic} />
	{/if}
{:else if stage === 'ended'}
	<div class="center endscr">
		<h2 class="white-text" in:fly={{ y: -20 }}>Game over!</h2>
		<div class="placewrap" in:scale={{ start: 0.2, duration: 700, easing: backOut, delay: 200 }}>
			{#if end.rank <= 3}<span class="crown">{['👑', '🥈', '🥉'][end.rank - 1]}</span>{/if}
			<Avatar avatar={me.avatar} size={140} bob />
		</div>
		<h1 class="place white-text" in:scale={{ start: 0.5, duration: 600, easing: backOut, delay: 500 }}>{ordinal(end.rank)} place</h1>
		<p class="white-text sub">out of {end.total} players</p>
		<div class="final" in:fly={{ y: 20, delay: 800 }}>
			{#if end.mode === 'gold'}🪙{:else}⭐{/if}
			<AnimatedNumber value={end.mode === 'gold' ? me.gold : me.score} duration={1500} />
		</div>
		<div class="stats" in:fly={{ y: 20, delay: 1000 }}>
			<span class="pill">✅ {me.correct} correct</span>
			<span class="pill">📝 {me.answered} answered</span>
		</div>
		<button class="btn big" onclick={() => navigate('/')} in:fly={{ y: 20, delay: 1200 }}>Play another 🎮</button>
	</div>
{/if}

<style>
	.center {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px 16px;
		gap: 12px;
		text-align: center;
	}
	.spin {
		font-size: 3rem;
		animation: spin 1s linear infinite;
	}
	.msg {
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: center;
	}
	.emoji {
		font-size: 4rem;
	}
	.profile {
		width: min(440px, 100%);
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: center;
	}
	.pill.dark {
		background: var(--card-2);
		color: var(--ink-soft);
	}
	.namerow {
		display: flex;
		gap: 10px;
		width: 100%;
	}
	.roll {
		padding: 0 16px;
		font-size: 1.5rem;
	}
	.roll:active {
		rotate: 180deg;
	}
	.err {
		margin: -4px 0 0;
		color: var(--bad);
		font-weight: 600;
	}
	.profile > .btn {
		width: 100%;
	}
	.lobby h1 {
		font-size: 2.4rem;
	}
	.sub {
		margin: 0;
		font-size: 1.15rem;
		opacity: 0.9;
	}
	.waitdots {
		display: flex;
		gap: 10px;
		margin: 14px 0;
	}
	.waitdots span {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		animation: bounce 1s ease-in-out infinite;
	}
	.waitdots span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.waitdots span:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		50% {
			transform: translateY(-12px);
			opacity: 1;
		}
	}
	.restyle summary {
		list-style: none;
	}
	.restyle summary::-webkit-details-marker {
		display: none;
	}
	.mini {
		margin-top: 12px;
		width: min(400px, 92vw);
		animation: pop-in 0.4s var(--spring);
	}
	.placewrap {
		position: relative;
		margin-top: 44px;
	}
	.crown {
		position: absolute;
		top: -44px;
		left: 50%;
		translate: -50% 0;
		font-size: 3rem;
		animation: wiggle 1.2s ease-in-out infinite;
	}
	.place {
		font-size: clamp(2.6rem, 10vw, 4rem);
	}
	.final {
		background: #fff;
		padding: 6px 30px;
		border-radius: 999px;
		font-size: 2.2rem;
		font-weight: 700;
		box-shadow: 0 6px 0 var(--gold-dark), 0 0 0 4px var(--gold);
		font-variant-numeric: tabular-nums;
	}
	.stats {
		display: flex;
		gap: 8px;
		margin: 6px 0 10px;
	}
</style>
