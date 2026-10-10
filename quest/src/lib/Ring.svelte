<script>
	import { clock } from './clock.svelte.js';
	let { startsAt, time, size = 90 } = $props();
	const left = $derived(Math.max(0, startsAt + time * 1000 - clock.now));
	const frac = $derived(Math.min(1, left / (time * 1000)));
	const secs = $derived(Math.ceil(left / 1000));
	const r = 42;
	const c = 2 * Math.PI * r;
</script>

<div class="ring" class:urgent={secs <= 5 && secs > 0} style="--s:{size}px">
	<svg viewBox="0 0 100 100">
		<circle cx="50" cy="50" r={r} class="track" />
		<circle cx="50" cy="50" r={r} class="prog" stroke-dasharray={c} stroke-dashoffset={c * (1 - frac)} />
	</svg>
	<span>{secs}</span>
</div>

<style>
	.ring {
		position: relative;
		width: var(--s);
		height: var(--s);
		flex: none;
	}
	svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	circle {
		fill: none;
		stroke-width: 10;
	}
	.track {
		stroke: rgba(255, 255, 255, 0.25);
		fill: rgba(255, 255, 255, 0.12);
	}
	.prog {
		stroke: var(--gold);
		stroke-linecap: round;
		transition: stroke-dashoffset 0.26s linear, stroke 0.3s;
	}
	.urgent .prog {
		stroke: var(--bad);
	}
	.urgent span {
		animation: pulse 0.5s ease-in-out infinite alternate;
	}
	span {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #fff;
		font-weight: 700;
		font-size: calc(var(--s) * 0.36);
		font-variant-numeric: tabular-nums;
	}
	@keyframes pulse {
		to {
			transform: scale(1.18);
		}
	}
</style>
