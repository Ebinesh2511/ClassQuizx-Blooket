<script>
	import { ANIMALS, COLORS, HATS } from './avatars.js';
	let { avatar, size = 64, bob = false, delay = 0, dim = false } = $props();
	const a = $derived(avatar ?? { animal: 0, color: 0, hat: 0 });
	const hat = $derived(HATS[a.hat] || '');
</script>

<div
	class="av"
	class:bob
	class:dim
	style="--s:{size}px; --c:{COLORS[a.color] ?? COLORS[0]}; animation-delay:{delay}ms"
	title={ANIMALS[a.animal]?.[1]}
>
	<span class="face">{ANIMALS[a.animal]?.[0] ?? '🦊'}</span>
	{#if hat}<span class="hat">{hat}</span>{/if}
</div>

<style>
	.av {
		position: relative;
		width: var(--s);
		height: var(--s);
		flex: none;
		border-radius: 32%;
		background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--c) 55%, white), var(--c) 70%);
		box-shadow:
			inset 0 calc(var(--s) * -0.07) 0 color-mix(in srgb, var(--c) 70%, black),
			0 calc(var(--s) * 0.06) calc(var(--s) * 0.15) rgba(30, 10, 80, 0.25);
		display: grid;
		place-items: center;
		transition: transform 0.3s var(--spring), filter 0.3s;
	}
	.bob {
		animation: bob 2.6s ease-in-out infinite;
	}
	.dim {
		filter: grayscale(0.9) opacity(0.55);
	}
	.face {
		font-size: calc(var(--s) * 0.62);
		line-height: 1;
		transform: translateY(calc(var(--s) * -0.02));
		filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.12));
	}
	.hat {
		position: absolute;
		top: calc(var(--s) * -0.26);
		right: calc(var(--s) * -0.14);
		font-size: calc(var(--s) * 0.42);
		transform: rotate(14deg);
		filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.2));
	}
</style>
