<script>
	import { onMount } from 'svelte';
	import { fly, scale, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { backOut } from 'svelte/easing';
	import { route, navigate } from '../lib/router.svelte.js';
	import { socket, call, syncClock } from '../lib/socket.js';
	import { clock, fmt } from '../lib/clock.svelte.js';
	import { sfx } from '../lib/sfx.js';
	import { toast } from '../lib/toast.svelte.js';
	import { feedText, liveFeed } from '../lib/rewards.js';
	import Avatar from '../lib/Avatar.svelte';
	import Leaderboard from '../lib/Leaderboard.svelte';
	import AnimatedNumber from '../lib/AnimatedNumber.svelte';
	import QR from '../lib/QR.svelte';
	import Ring from '../lib/Ring.svelte';
	import Podium from '../lib/Podium.svelte';

	const pin = route.query.get('pin') ?? '';
	let s = $state(null);
	let lost = $state(false);
	let base = $state(location.origin);
	let qrBig = $state(false);

	const joinUrl = $derived(`${base}/play?pin=${pin}`);
	const shortUrl = $derived(base.replace(/^https?:\/\//, ''));
	const pinPretty = `${pin.slice(0, 3)} ${pin.slice(3)}`;
	const metric = $derived(s?.mode === 'classic' ? 'score' : 'gold');
	const names = $derived(Object.fromEntries((s?.players ?? []).map((p) => [p.id, p])));
	const nameOf = (id) => names[id]?.name ?? 'Someone';
	const feed = $derived(liveFeed(s?.feed, s?.status));
	const timeLeft = $derived(s?.endsAt ? s.endsAt - clock.now : null);
	const leader = $derived(s?.players?.[0]);
	const goalPct = $derived(s?.settings?.endBy === 'goal' && leader ? Math.min(1, leader.gold / s.settings.goal) : 0);

	let prevCount = 0;
	let lastFeedId = null;
	function onState(next) {
		syncClock(next.serverNow);
		if (next.players.length > prevCount && next.status === 'lobby') sfx.join();
		prevCount = next.players.length;
		const newest = next.feed.at(-1);
		if (newest && newest.id !== lastFeedId && next.status === 'playing' && ['swap', 'dragon', 'take'].includes(newest.kind)) sfx.coin();
		lastFeedId = newest?.id;
		if (s && s.status !== 'ended' && next.status === 'ended') sfx.fanfare();
		s = next;
	}

	async function resume() {
		let hostToken = null;
		try { hostToken = localStorage.getItem(`qq-host-${pin}`); } catch {}
		if (!hostToken) return (lost = true);
		const r = await call('host:resume', { pin, hostToken });
		if (r?.error) return (lost = true);
		onState(r.state);
	}

	onMount(() => {
		socket.on('host:state', onState);
		socket.on('connect', resume);
		if (socket.connected) resume();
		const host = location.hostname;
		if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
			fetch('/api/info')
				.then((r) => r.json())
				.then((d) => d.lan?.[0] && (base = d.lan[0]))
				.catch(() => {});
		}
		return () => {
			socket.off('host:state', onState);
			socket.off('connect', resume);
		};
	});

	async function act(ev, data) {
		sfx.click();
		const r = await call(ev, data);
		if (r?.error) toast(r.error, { icon: '🙈', kind: 'bad' });
		return r;
	}
	const start = () => act('host:start');
	let confirmEnd = $state(false);
	let confirmTimer;
	function end() {
		if (!confirmEnd) {
			confirmEnd = true;
			sfx.click();
			clearTimeout(confirmTimer);
			confirmTimer = setTimeout(() => (confirmEnd = false), 3000);
			return;
		}
		confirmEnd = false;
		act('host:end');
	}
	const next = () => act('host:next');
	async function kick(p) {
		const r = await act('host:kick', { playerId: p.id });
		if (!r?.error) toast(`${p.name} was removed`, { icon: '👢' });
	}
	function copy() {
		navigator.clipboard?.writeText(joinUrl);
		toast('Join link copied!', { icon: '📋', kind: 'good' });
	}
	function playAgain() {
		navigate('/host');
	}

	const shapes = ['▲', '◆', '●', '■', '★', '⬟'];
	const c = $derived(s?.classic);
	const maxDist = $derived(Math.max(1, ...(c?.distribution ?? [0])));
	const isLast = $derived(c && c.index >= s.questionCount - 1);
</script>

{#if lost}
	<div class="center">
		<div class="card lostcard" in:scale>
			<div class="big-emoji">🦥</div>
			<h2>This game isn't available</h2>
			<p>It may have ended, or it was hosted from another browser tab.</p>
			<button class="btn purple" onclick={() => navigate('/host')}>Host a new game</button>
		</div>
	</div>
{:else if !s}
	<div class="center"><div class="spinner">🪙</div></div>
{:else if s.status === 'lobby'}
	<!-- ================= LOBBY ================= -->
	<div class="lobby">
		<div class="joinbar" in:fly={{ y: -40, duration: 500, easing: backOut }}>
			<div class="joininfo">
				<span class="lbl">Join at</span>
				<button class="url" onclick={copy} title="Copy link">{shortUrl}/play</button>
				<span class="lbl">with Game ID</span>
				<span class="pinbig">{pinPretty}</span>
			</div>
			<button class="qrbtn" onclick={() => (qrBig = true)} title="Show big QR code">
				<QR text={joinUrl} size={150} />
				<span>Tap to enlarge</span>
			</button>
		</div>

		<div class="lobbymeta">
			<span class="pill">{s.mode === 'gold' ? '🪙 Gold Quest' : '⚡ Classic'}</span>
			<span class="pill">📚 {s.title} · {s.questionCount} Qs</span>
			<span class="pill count">👥 <AnimatedNumber value={s.players.length} duration={300} /></span>
			<span class="spacer"></span>
			<button class="btn big green" disabled={!s.players.length} onclick={start}>Start ▶</button>
		</div>

		{#if !s.players.length}
			<div class="waiting" in:fade>
				<div class="dots"><span>🐣</span><span>🐣</span><span>🐣</span></div>
				<p class="white-text">Waiting for players to join…</p>
			</div>
		{:else}
			<div class="crowd">
				{#each s.players as p (p.id)}
					<button
						class="buddy"
						animate:flip={{ duration: 400 }}
						in:scale={{ duration: 500, start: 0.2, easing: backOut }}
						out:scale={{ duration: 250 }}
						onclick={() => kick(p)}
						title="Click to remove"
					>
						<Avatar avatar={p.avatar} size={64} bob delay={(p.id.charCodeAt(0) * 37) % 2000} dim={!p.connected} />
						<span>{p.name}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else if s.status === 'playing' && s.mode === 'gold'}
	<!-- ================= GOLD QUEST LIVE ================= -->
	<div class="live">
		<header class="topbar" in:fly={{ y: -30, duration: 400 }}>
			<div class="tb-left">
				<span class="pill">🪙 Gold Quest</span>
				<span class="pill">ID {pinPretty}</span>
			</div>
			<div class="tb-mid">
				{#if s.settings.endBy === 'time'}
					<div class="timer" class:urgent={timeLeft < 30_000}>⏱ {fmt(timeLeft)}</div>
				{:else}
					<div class="goal">
						<span>🎯 First to {s.settings.goal.toLocaleString()}</span>
						<div class="goalbar"><span style="transform:scaleX({goalPct})"></span></div>
					</div>
				{/if}
			</div>
			<div class="tb-right">
				{#if s.settings.endBy === 'time'}<button class="btn sm white" onclick={() => act('host:extend', { minutes: 1 })}>+1 min</button>{/if}
				<button class="btn sm red" class:pulse={confirmEnd} onclick={end}>{confirmEnd ? 'Sure? Tap again' : 'End game'}</button>
			</div>
		</header>

		<div class="grid">
			<section class="main">
				<div class="strip">
					<div class="dragon card glass" class:hot={s.dragonPool > 0}>
						<span class="dicon">🐉</span>
						<div>
							<span class="sub">Dragon's Treasure</span>
							<strong>🪙 <AnimatedNumber value={s.dragonPool} /></strong>
						</div>
					</div>
					<button class="mini-qr card glass" onclick={() => (qrBig = true)}>
						<QR text={joinUrl} size={72} />
						<div><span class="sub">Late? Join with</span><strong>{pinPretty}</strong></div>
					</button>
				</div>
				<div class="feed card glass">
					<h3>⚡ Live action <span class="sub">newest first</span></h3>
					<ul>
						{#each feed as e (e.id)}
							{@const f = feedText(e, nameOf)}
							<li class="k-{e.kind}" animate:flip={{ duration: 350 }} in:fly={{ y: -36, duration: 420, easing: backOut }} out:fade={{ duration: 150 }}>
								{#if names[e.actor]}<Avatar avatar={names[e.actor].avatar} size={36} />{/if}
								<span class="fi">{f.icon}</span>
								<span class="ft">{f.text}</span>
							</li>
						{/each}
						{#if !feed.length}<li class="empty">Chests will start popping soon…</li>{/if}
					</ul>
				</div>
			</section>
			<aside class="board card glass">
				<h2>🏆 Leaderboard <span class="sub">{s.players.length}</span></h2>
				<Leaderboard players={s.players} metric="gold" onkick={kick} compact />
			</aside>
		</div>
	</div>
{:else if s.status === 'playing' && s.mode === 'classic'}
	<!-- ================= CLASSIC LIVE ================= -->
	<div class="classic">
		<header class="topbar">
			<div class="tb-left">
				<span class="pill">⚡ Classic</span>
				<span class="pill">Question {c.index + 1} / {s.questionCount}</span>
			</div>
			<div class="tb-mid"></div>
			<div class="tb-right">
				<button class="btn sm red" class:pulse={confirmEnd} onclick={end}>{confirmEnd ? 'Sure? Tap again' : 'End game'}</button>
			</div>
		</header>

		{#key c.index + c.phase}
			<div class="stage" in:fly={{ y: 30, duration: 450 }}>
				{#if c.phase === 'question' || c.phase === 'reveal'}
					{#if c.phase === 'question' && clock.now < c.startedAt}
						<div class="getready">
							<p class="white-text">Question {c.index + 1}</p>
							{#key Math.ceil((c.startedAt - clock.now) / 1000)}
								<span class="cd" in:scale={{ start: 2, duration: 400 }}>{Math.min(3, Math.max(1, Math.ceil((c.startedAt - clock.now) / 1000)))}</span>
							{/key}
						</div>
					{:else}
						<div class="qcard card">
							<h2>{c.question.text}</h2>
						</div>
						<div class="qmid">
							{#if c.phase === 'question'}
								<Ring startsAt={c.startedAt} time={c.question.time} size={110} />
								<div class="answered">
									<strong><AnimatedNumber value={c.answeredCount} duration={300} /></strong>
									<span>answered</span>
								</div>
								<button class="btn white" onclick={next}>Skip ⏭</button>
							{:else}
								<div class="dist">
									{#each c.distribution as n, i}
										<div class="dcol" class:ok={c.question.correct.includes(i)} style="--c:var(--a{i}); --cd:var(--a{i}d)">
											<span class="dn">{n}</span>
											<span class="dbar" style="transform:scaleY({Math.max(0.04, n / maxDist)}); transition-delay:{i * 80}ms"></span>
											<span class="ds">{shapes[i]} {#if c.question.correct.includes(i)}✔{/if}</span>
										</div>
									{/each}
								</div>
								<button class="btn big" onclick={next}>Leaderboard ➜</button>
							{/if}
						</div>
						<div class="tiles">
							{#each c.question.answers as a, i}
								<div
									class="tile"
									class:faded={c.phase === 'reveal' && !c.question.correct.includes(i)}
									class:ok={c.phase === 'reveal' && c.question.correct.includes(i)}
									style="--c:var(--a{i}); --cd:var(--a{i}d); animation-delay:{i * 80}ms"
								>
									<span class="shape">{shapes[i]}</span>{a}
								</div>
							{/each}
						</div>
					{/if}
				{:else if c.phase === 'leaderboard'}
					<div class="lbwrap">
						<h1 class="white-text">🏆 Leaderboard</h1>
						<div class="card glass">
							<Leaderboard players={s.players} metric="score" limit={8} />
						</div>
						<button class="btn big" onclick={next}>{isLast ? 'Final results 🎉' : 'Next question ➜'}</button>
					</div>
				{/if}
			</div>
		{/key}
	</div>
{:else if s.status === 'ended'}
	<!-- ================= RESULTS ================= -->
	<div class="results">
		<h1 class="white-text" in:fly={{ y: -30, duration: 500 }}>🎉 {s.mode === 'gold' ? 'Gold Quest' : 'Game'} over!</h1>
		<Podium podium={s.players.slice(0, 3)} metric={metric} />
		<div class="card glass final" in:fly={{ y: 40, duration: 600, delay: 3200 }}>
			<Leaderboard players={s.players} metric={metric} />
		</div>
		<div class="actions" in:fade={{ delay: 3400 }}>
			<button class="btn big green" onclick={playAgain}>Play again 🔁</button>
			<button class="btn big white" onclick={() => navigate('/')}>Home</button>
		</div>
	</div>
{/if}

{#if qrBig}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" transition:fade={{ duration: 200 }} onclick={() => (qrBig = false)}>
		<div class="qrmodal" in:scale={{ start: 0.6, duration: 450, easing: backOut }}>
			<QR text={joinUrl} size={Math.min(440, innerWidth - 80)} />
			<p>Scan to join · <b>{pinPretty}</b></p>
			<span class="small">{joinUrl}</span>
		</div>
	</div>
{/if}

<style>
	.center {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 16px;
	}
	.lostcard {
		text-align: center;
		max-width: 420px;
	}
	.lostcard p {
		color: var(--ink-soft);
	}
	.big-emoji {
		font-size: 4rem;
	}
	.spinner {
		font-size: 3rem;
		animation: spin 1s linear infinite;
	}
	.glass {
		background: rgba(255, 255, 255, 0.16);
		backdrop-filter: blur(14px);
		box-shadow: 0 10px 40px rgba(20, 0, 60, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.sub {
		font-size: 0.85rem;
		font-weight: 500;
		opacity: 0.75;
	}

	.pulse {
		animation: wiggle 0.4s ease-in-out infinite;
	}

	/* lobby */
	.lobby {
		padding: 16px;
		max-width: 1300px;
		margin: 0 auto;
	}
	.joinbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		background: #fff;
		border-radius: 28px;
		padding: 18px 18px 18px 30px;
		box-shadow: 0 8px 0 #d6ccf5, 0 20px 50px rgba(30, 10, 80, 0.3);
	}
	.joininfo {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 4px 14px;
	}
	.lbl {
		font-size: 1.3rem;
		color: var(--ink-soft);
		font-weight: 500;
	}
	.url {
		font-size: 1.6rem;
		font-weight: 700;
		color: #5b3cc4;
		border-bottom: 3px dashed #c9bbf7;
	}
	.url:hover {
		color: #7c5cff;
	}
	.pinbig {
		font-size: clamp(3rem, 8vw, 5.5rem);
		font-weight: 700;
		letter-spacing: 0.04em;
		line-height: 1;
		background: linear-gradient(90deg, #6c47ff, #ff5fa2);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		width: 100%;
	}
	.qrbtn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--ink-soft);
		transition: transform 0.25s var(--spring);
	}
	.qrbtn:hover {
		transform: scale(1.05) rotate(-2deg);
	}
	.lobbymeta {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 22px 0;
		flex-wrap: wrap;
	}
	.spacer {
		flex: 1;
	}
	.count {
		font-size: 1.2rem;
	}
	.waiting {
		text-align: center;
		margin-top: 8vh;
		font-size: 1.4rem;
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: 14px;
		font-size: 2.6rem;
	}
	.dots span {
		animation: bob 1.2s ease-in-out infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}
	.crowd {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		justify-content: center;
	}
	.buddy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 120px;
		padding: 12px 6px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-weight: 600;
		transition: background 0.2s, transform 0.25s var(--spring);
	}
	.buddy span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.buddy:hover {
		background: rgba(255, 84, 104, 0.4);
		transform: scale(1.06) rotate(-2deg);
	}

	/* live */
	.live,
	.classic {
		padding: 14px 16px;
		max-width: 1400px;
		margin: 0 auto;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}
	.tb-left,
	.tb-right {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.tb-right {
		justify-content: flex-end;
	}
	.timer {
		font-size: 2.4rem;
		font-weight: 700;
		color: #fff;
		background: rgba(0, 0, 0, 0.2);
		padding: 4px 26px;
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
		transition: background 0.3s;
	}
	.timer.urgent {
		background: var(--bad);
		animation: wiggle 0.6s ease-in-out infinite;
	}
	.goal {
		color: #fff;
		font-weight: 700;
		text-align: center;
		min-width: 260px;
	}
	.goalbar {
		height: 12px;
		border-radius: 9px;
		background: rgba(0, 0, 0, 0.25);
		overflow: hidden;
		margin-top: 6px;
	}
	.goalbar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--gold), #ff9d3c);
		transform-origin: left;
		transition: transform 0.6s var(--smooth);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
		gap: 16px;
		align-items: start;
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}
	.strip {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.board {
		padding: 16px;
		max-height: calc(100dvh - 110px);
		overflow-y: auto;
		position: sticky;
		top: 14px;
	}
	.board h2,
	.feed h3 {
		color: #fff;
		margin-bottom: 14px;
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.dragon {
		display: flex;
		align-items: center;
		gap: 14px;
		color: #fff;
		padding: 16px 20px;
	}
	.dragon strong {
		display: block;
		font-size: 1.6rem;
	}
	.dicon {
		font-size: 2.8rem;
		transition: transform 0.4s var(--spring);
	}
	.dragon.hot .dicon {
		animation: wiggle 1.2s ease-in-out infinite;
	}
	.feed {
		padding: 18px;
	}
	.feed ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: calc(100dvh - 260px);
		overflow: hidden;
	}
	.feed li {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fff;
		padding: 8px 10px;
		border-radius: 14px;
		font-weight: 500;
		font-size: 1.15rem;
	}
	.feed li.k-swap {
		background: #f2e8ff;
	}
	.feed li.k-take {
		background: #e6f2ff;
	}
	.feed li.k-lose {
		background: #ffe9ec;
	}
	.feed li.k-dragon {
		background: linear-gradient(90deg, #fff1c2, #ffd9a8);
	}
	.feed li.empty {
		background: transparent;
		color: #fff;
		opacity: 0.7;
	}
	.fi {
		font-size: 1.2rem;
	}
	.ft {
		flex: 1;
		min-width: 0;
	}
	.mini-qr {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		color: #fff;
		text-align: left;
	}
	.mini-qr strong {
		display: block;
		font-size: 1.6rem;
		letter-spacing: 0.05em;
	}

	/* classic */
	.stage {
		display: flex;
		flex-direction: column;
		gap: 18px;
		align-items: center;
	}
	.getready {
		text-align: center;
		margin-top: 14vh;
		font-size: 2rem;
	}
	.cd {
		display: inline-block;
		font-size: 9rem;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 8px 0 rgba(0, 0, 0, 0.15);
	}
	.qcard {
		width: 100%;
		text-align: center;
		padding: 30px;
	}
	.qcard h2 {
		font-size: clamp(1.6rem, 3.5vw, 2.6rem);
	}
	.qmid {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 180px;
		gap: 20px;
	}
	.answered {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #fff;
		font-size: 1.2rem;
	}
	.answered strong {
		font-size: 4rem;
		line-height: 1;
	}
	.dist {
		display: flex;
		gap: 16px;
		align-items: flex-end;
		height: 180px;
		flex: 1;
		justify-content: center;
	}
	.dcol {
		width: 80px;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		color: #fff;
		font-weight: 700;
	}
	.dbar {
		width: 100%;
		height: 130px;
		background: var(--c);
		border-radius: 12px 12px 4px 4px;
		box-shadow: inset 0 -6px 0 var(--cd);
		transform-origin: bottom;
		transition: transform 0.7s var(--spring);
		animation: grow 0.7s var(--spring) both;
	}
	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}
	.dcol:not(.ok) .dbar {
		opacity: 0.45;
	}
	.dn {
		font-size: 1.4rem;
	}
	.tiles {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.tile {
		background: var(--c);
		color: #fff;
		font-size: 1.5rem;
		font-weight: 600;
		padding: 22px;
		border-radius: 20px;
		display: flex;
		align-items: center;
		gap: 14px;
		box-shadow: 0 7px 0 var(--cd);
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
		animation: pop-in 0.5s var(--spring) both;
		transition: opacity 0.4s, transform 0.4s var(--spring), filter 0.4s;
	}
	.tile.faded {
		opacity: 0.3;
		filter: grayscale(0.5);
	}
	.tile.ok {
		transform: scale(1.03);
		outline: 5px solid #fff;
		outline-offset: -5px;
	}
	.shape {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.25);
		display: grid;
		place-items: center;
	}
	.lbwrap {
		width: min(760px, 100%);
		display: flex;
		flex-direction: column;
		gap: 18px;
		align-items: center;
	}
	.lbwrap .card {
		width: 100%;
	}

	/* results */
	.results {
		max-width: 900px;
		margin: 0 auto;
		padding: 30px 16px 60px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 22px;
	}
	.results h1 {
		font-size: clamp(2rem, 5vw, 3.2rem);
	}
	.final {
		width: 100%;
		max-height: 50vh;
		overflow: auto;
	}
	.actions {
		display: flex;
		gap: 14px;
	}

	/* overlay */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 5, 60, 0.7);
		backdrop-filter: blur(6px);
		display: grid;
		place-items: center;
		z-index: 60;
		cursor: zoom-out;
	}
	.qrmodal {
		background: #fff;
		border-radius: 30px;
		padding: 24px;
		text-align: center;
		box-shadow: 0 10px 0 #d6ccf5;
	}
	.qrmodal p {
		font-size: 1.6rem;
		margin: 12px 0 2px;
	}
	.small {
		color: var(--ink-soft);
		font-size: 0.9rem;
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.joinbar {
			flex-direction: column;
			padding: 18px;
		}
		.topbar {
			grid-template-columns: 1fr;
			justify-items: center;
		}
		.tiles {
			grid-template-columns: 1fr;
		}
		.qmid {
			flex-wrap: wrap;
			justify-content: center;
		}
	}
</style>
