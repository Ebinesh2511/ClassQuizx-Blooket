<script>
	import { sfx } from './sfx.js';
	// state: per-answer 'idle' | 'picked' | 'correct' | 'wrong' | 'faded'
	let { answers = [], multi = false, disabled = false, reveal = null, picked = [], onanswer, big = false } = $props();
	const shapes = ['▲', '◆', '●', '■', '★', '⬟'];
	let selected = $state([]);
	$effect(() => {
		answers;
		selected = [];
	});
	function press(i) {
		if (disabled || reveal) return;
		sfx.click();
		if (!multi) return onanswer?.([i]);
		selected = selected.includes(i) ? selected.filter((s) => s !== i) : [...selected, i];
	}
	function stateOf(i) {
		if (reveal) {
			if (reveal.includes(i)) return 'correct';
			if (picked.includes(i)) return 'wrong';
			return 'faded';
		}
		if (selected.includes(i) || picked.includes(i)) return 'picked';
		return 'idle';
	}
</script>

<div class="grid" class:big class:three={answers.length === 3}>
	{#each answers as a, i}
		<button
			class="ans s-{stateOf(i)}"
			style="--c:var(--a{i}); --cd:var(--a{i}d); animation-delay:{i * 70}ms"
			disabled={disabled && !reveal}
			onclick={() => press(i)}
		>
			<span class="shape">{shapes[i]}</span>
			<span class="txt">{a}</span>
			{#if stateOf(i) === 'correct'}<span class="mark">✔</span>{/if}
			{#if stateOf(i) === 'wrong'}<span class="mark">✖</span>{/if}
		</button>
	{/each}
</div>
{#if multi && !reveal}
	<div class="multi">
		<span>Pick all that are right</span>
		<button class="btn green" disabled={!selected.length || disabled} onclick={() => onanswer?.(selected)}>Submit ✓</button>
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		width: 100%;
	}
	.ans {
		position: relative;
		min-height: 96px;
		padding: 16px 18px;
		border-radius: 20px;
		background: var(--c);
		color: #fff;
		font-size: 1.25rem;
		font-weight: 600;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 14px;
		box-shadow: 0 7px 0 var(--cd), 0 12px 24px rgba(30, 10, 80, 0.2);
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
		transition:
			transform 0.2s var(--spring),
			box-shadow 0.2s var(--spring),
			opacity 0.3s,
			filter 0.3s;
		animation: pop-in 0.5s var(--spring) both;
		word-break: break-word;
	}
	.big .ans {
		min-height: 130px;
		font-size: 1.6rem;
	}
	.ans:not(:disabled):hover {
		transform: translateY(-3px) scale(1.02);
		box-shadow: 0 10px 0 var(--cd), 0 16px 30px rgba(30, 10, 80, 0.25);
	}
	.ans:not(:disabled):active {
		transform: translateY(6px) scale(0.97);
		box-shadow: 0 1px 0 var(--cd);
		transition-duration: 0.05s;
	}
	.ans:disabled {
		cursor: default;
	}
	.shape {
		width: 42px;
		height: 42px;
		flex: none;
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.25);
		border-radius: 12px;
		font-size: 1.3rem;
	}
	.txt {
		flex: 1;
	}
	.s-picked {
		outline: 5px solid #fff;
		outline-offset: -5px;
		transform: scale(0.97);
	}
	.s-correct {
		transform: scale(1.04);
		z-index: 1;
		outline: 5px solid #fff;
		outline-offset: -5px;
	}
	.s-wrong {
		filter: saturate(0.4);
		animation: shake 0.45s;
	}
	.s-faded {
		opacity: 0.3;
		filter: grayscale(0.6);
	}
	.mark {
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #fff;
		color: var(--cd);
		display: grid;
		place-items: center;
		font-size: 1.3rem;
		animation: pop-in 0.4s var(--spring);
	}
	.multi {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 16px;
		color: #fff;
		font-weight: 600;
	}
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
			gap: 10px;
		}
		.ans {
			min-height: 70px;
			font-size: 1.1rem;
		}
	}
</style>
