<script>
	import { onMount } from 'svelte';
	import Avatar from './Avatar.svelte';
	import AnimatedNumber from './AnimatedNumber.svelte';
	import { celebrate } from './confetti.js';
	import { sfx } from './sfx.js';
	let { podium = [], metric = 'gold' } = $props();
	// display order: 2nd, 1st, 3rd
	const slots = $derived([podium[1], podium[0], podium[2]].map((p, i) => ({ p, place: [2, 1, 3][i] })));
	let shown = $state(0);
	onMount(() => {
		const timers = [600, 1500, 2600].map((t, i) =>
			setTimeout(() => {
				shown = i + 1;
				if (i === 2) {
					sfx.fanfare();
					celebrate(3000);
				} else sfx.pop();
			}, t)
		);
		return () => timers.forEach(clearTimeout);
	});
	// 3rd appears first, then 2nd, then 1st
	const visible = (place) => (place === 3 ? shown >= 1 : place === 2 ? shown >= 2 : shown >= 3);
</script>

<div class="podium">
	{#each slots as { p, place }}
		<div class="col p{place}" class:on={visible(place) && p}>
			{#if p}
				<div class="who">
					{#if place === 1}<span class="crown">👑</span>{/if}
					<Avatar avatar={p.avatar} size={place === 1 ? 96 : 76} bob />
					<span class="name">{p.name}</span>
					<span class="val">{metric === 'gold' ? '🪙 ' : ''}<AnimatedNumber value={visible(place) ? p[metric] : 0} duration={1200} /></span>
				</div>
			{/if}
			<div class="block"><span>{place}</span></div>
		</div>
	{/each}
</div>

<style>
	.podium {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 14px;
		padding-top: 40px;
	}
	.col {
		width: min(30vw, 200px);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.who {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		margin-bottom: 12px;
		opacity: 0;
		transform: translateY(40px) scale(0.6);
		transition: all 0.7s var(--spring) 0.35s;
		position: relative;
	}
	.on .who {
		opacity: 1;
		transform: none;
	}
	.crown {
		position: absolute;
		top: -38px;
		font-size: 38px;
		animation: wiggle 1.4s ease-in-out infinite;
	}
	.name {
		color: #fff;
		font-weight: 700;
		font-size: 1.15rem;
		text-align: center;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.val {
		background: #fff;
		padding: 2px 12px;
		border-radius: 999px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.block {
		width: 100%;
		border-radius: 18px 18px 6px 6px;
		display: grid;
		place-items: start center;
		padding-top: 12px;
		font-size: 2.6rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		transform: scaleY(0);
		transform-origin: bottom;
		transition: transform 0.6s var(--spring);
	}
	.on .block {
		transform: scaleY(1);
	}
	.p1 .block {
		height: 190px;
		background: linear-gradient(180deg, #ffd34d, #f5a300);
		box-shadow: inset 0 -10px 0 #d98b00;
	}
	.p2 .block {
		height: 140px;
		background: linear-gradient(180deg, #e3e8f5, #aab4cc);
		box-shadow: inset 0 -10px 0 #8b95ad;
	}
	.p3 .block {
		height: 105px;
		background: linear-gradient(180deg, #ffb27a, #d9773a);
		box-shadow: inset 0 -10px 0 #b35c25;
	}
</style>
