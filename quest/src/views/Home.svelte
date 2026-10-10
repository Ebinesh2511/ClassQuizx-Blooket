<script>
	import { navigate } from '../lib/router.svelte.js';
	import { call } from '../lib/socket.js';
	import { sfx } from '../lib/sfx.js';
	import Avatar from '../lib/Avatar.svelte';
	import { randomAvatar } from '../lib/avatars.js';

	let pin = $state('');
	let err = $state('');
	let shaking = $state(false);
	let busy = $state(false);
	const parade = Array.from({ length: 7 }, randomAvatar);
	const title = 'QuizQuest'.split('');

	async function join(e) {
		e.preventDefault();
		const code = pin.replace(/\D/g, '');
		if (code.length !== 6) return fail('Game codes have 6 digits');
		busy = true;
		const r = await call('player:check', { pin: code });
		busy = false;
		if (r?.error) return fail(r.error);
		sfx.join();
		navigate(`/play?pin=${code}`);
	}
	function fail(m) {
		err = m;
		sfx.wrong();
		shaking = true;
		setTimeout(() => (shaking = false), 450);
	}
</script>

<div class="home">
	<h1 class="logo" aria-label="QuizQuest">
		{#each title as ch, i}<span style="animation-delay:{i * 60}ms; --r:{(i % 2 ? 1 : -1) * 4}deg">{ch}</span>{/each}
	</h1>
	<p class="tag white-text">Answer. Open chests. Steal gold. Win. 🏆</p>

	<form class="card join" class:shake={shaking} onsubmit={join}>
		<input
			class="input pin"
			inputmode="numeric"
			autocomplete="off"
			placeholder="Game ID"
			maxlength="7"
			bind:value={pin}
			oninput={() => (err = '')}
		/>
		<button class="btn big purple" disabled={busy}>{busy ? 'Checking…' : 'Join game'} <span class="arrow">➜</span></button>
		<p class="err" class:on={err}>{err || ' '}</p>
	</form>

	<div class="parade">
		{#each parade as a, i}<Avatar avatar={a} size={56} bob delay={i * 220} />{/each}
	</div>

	<div class="host card">
		<div>
			<h3>Teaching or hosting?</h3>
			<p>Upload a CSV quiz and start a Gold Quest or Classic game in seconds.</p>
		</div>
		<button class="btn big" onclick={() => navigate('/host')}>Host a game 🎮</button>
	</div>
</div>

<style>
	.home {
		max-width: 560px;
		margin: 0 auto;
		padding: 7vh 16px 40px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 22px;
	}
	.logo {
		font-size: clamp(3rem, 12vw, 5.2rem);
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.02em;
		display: flex;
		text-shadow: 0 6px 0 #3a1fa8, 0 12px 30px rgba(0, 0, 0, 0.25);
	}
	.logo span {
		display: inline-block;
		animation:
			pop-in 0.6s var(--spring) both,
			float 3s ease-in-out infinite;
		transition: transform 0.25s var(--spring), color 0.2s;
		cursor: default;
	}
	.logo span:hover {
		color: var(--gold);
		transform: translateY(-10px) rotate(var(--r)) scale(1.15);
		animation-play-state: paused;
	}
	@keyframes float {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 0 -4px;
		}
	}
	.tag {
		margin: -8px 0 0;
		font-size: 1.15rem;
		font-weight: 500;
	}
	.join {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 14px;
		animation: pop-in 0.6s var(--spring) 0.2s both;
	}
	.pin {
		font-size: 2rem;
		letter-spacing: 0.15em;
	}
	.pin::placeholder {
		letter-spacing: 0.02em;
		color: #b9aee0;
	}
	.arrow {
		transition: transform 0.25s var(--spring);
	}
	.btn:hover .arrow {
		transform: translateX(5px);
	}
	.err {
		margin: -4px 0 0;
		text-align: center;
		color: var(--bad);
		font-weight: 600;
		opacity: 0;
		transform: translateY(-4px);
		transition: all 0.25s;
	}
	.err.on {
		opacity: 1;
		transform: none;
	}
	.parade {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.host {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 16px;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.95);
		animation: pop-in 0.6s var(--spring) 0.35s both;
	}
	.host p {
		margin: 6px 0 0;
		color: var(--ink-soft);
	}
	@media (max-width: 520px) {
		.host {
			flex-direction: column;
			text-align: center;
		}
	}
</style>
