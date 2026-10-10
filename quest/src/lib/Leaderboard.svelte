<script>
	import { flip } from 'svelte/animate';
	import { fly, scale } from 'svelte/transition';
	import Avatar from './Avatar.svelte';
	import AnimatedNumber from './AnimatedNumber.svelte';
	let { players = [], metric = 'gold', limit = 50, highlight = null, onkick = null, compact = false } = $props();
	const shown = $derived(players.slice(0, limit));
	const top = $derived(Math.max(1, ...players.map((p) => p[metric] || 0)));
	const medal = (i) => ['🥇', '🥈', '🥉'][i] ?? i + 1;
</script>

<ol class="lb" class:compact>
	{#each shown as p, i (p.id)}
		<li
			class:me={p.id === highlight}
			class:off={!p.connected}
			animate:flip={{ duration: 600, easing: (t) => 1 - Math.pow(1 - t, 4) }}
			in:fly={{ y: 30, duration: 450 }}
			out:scale={{ duration: 250 }}
		>
			<span class="rank" class:medal={i < 3}>{medal(i)}</span>
			<Avatar avatar={p.avatar} size={compact ? 36 : 44} dim={!p.connected} />
			<div class="mid">
				<span class="name">{p.name}</span>
				<span class="bar"><span style="transform:scaleX({Math.max(0.02, (p[metric] || 0) / top)})"></span></span>
			</div>
			<span class="val">
				{#if metric === 'gold'}<span class="coin">🪙</span>{/if}
				<AnimatedNumber value={p[metric] || 0} />
			</span>
			{#if onkick}
				<button class="kick" title="Remove player" onclick={() => onkick(p)}>✕</button>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.lb {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 14px 8px 10px;
		background: #fff;
		border-radius: 18px;
		box-shadow: 0 4px 0 rgba(43, 26, 94, 0.1);
		will-change: transform;
	}
	.compact li {
		padding: 6px 10px 6px 8px;
		gap: 10px;
	}
	li.me {
		background: linear-gradient(90deg, #fff6d6, #fff);
		outline: 3px solid var(--gold);
	}
	li.off {
		opacity: 0.6;
	}
	.rank {
		width: 34px;
		text-align: center;
		font-weight: 700;
		color: var(--ink-soft);
		font-size: 1.05rem;
	}
	.rank.medal {
		font-size: 1.6rem;
	}
	.mid {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.name {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar {
		height: 7px;
		background: var(--card-2);
		border-radius: 9px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--gold), #ff9d3c);
		border-radius: 9px;
		transform-origin: left;
		transition: transform 0.7s var(--smooth);
	}
	.val {
		font-weight: 700;
		font-size: 1.15rem;
		font-variant-numeric: tabular-nums;
		min-width: 70px;
		text-align: right;
	}
	.coin {
		font-size: 0.95rem;
	}
	.kick {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		color: var(--ink-soft);
		opacity: 0;
		transition: opacity 0.2s, background 0.2s;
	}
	li:hover .kick {
		opacity: 1;
	}
	.kick:hover {
		background: #ffe0e4;
		color: var(--bad);
	}
</style>
