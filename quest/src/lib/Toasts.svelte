<script>
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { toasts } from './toast.svelte.js';
</script>

<div class="toasts">
	{#each toasts as t (t.id)}
		<div class="toast {t.kind}" animate:flip={{ duration: 300 }} in:fly={{ y: -40, duration: 400 }} out:fly={{ x: 60, duration: 300 }}>
			<span class="i">{t.icon}</span>{t.text}
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		top: 14px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
		pointer-events: none;
		width: min(92vw, 440px);
	}
	.toast {
		background: #fff;
		color: var(--ink);
		padding: 10px 18px;
		border-radius: 16px;
		font-weight: 600;
		box-shadow: 0 5px 0 rgba(43, 26, 94, 0.15), 0 10px 30px rgba(30, 10, 80, 0.3);
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.toast.bad {
		background: #fff0f2;
		outline: 3px solid var(--bad);
	}
	.toast.good {
		background: #effff5;
		outline: 3px solid var(--good);
	}
	.i {
		font-size: 1.4rem;
	}
</style>
