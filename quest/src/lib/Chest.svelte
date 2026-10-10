<script>
	import { rewardInfo } from './rewards.js';
	// state: 'closed' | 'open' | 'other' (revealed, not picked) | 'dim'
	let { state = 'closed', reward = null, delay = 0, onpick = null, disabled = false } = $props();
	const info = $derived(rewardInfo(reward));
</script>

<button
	class="chest s-{state} t-{info.tone}"
	style="--rc:{info.color}; animation-delay:{delay}ms"
	disabled={disabled || state !== 'closed'}
	onclick={onpick}
	aria-label="Treasure chest"
>
	<div class="rays"></div>
	<div class="box">
		<div class="lid"><span class="band"></span></div>
		<div class="base">
			<span class="band"></span>
			<span class="lock"></span>
		</div>
	</div>
	{#if state === 'open' || state === 'other'}
		<div class="reward">
			<span class="ricon">{info.icon}</span>
			<span class="rtitle">{info.title}</span>
		</div>
	{/if}
</button>

<style>
	.chest {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1.05;
		display: grid;
		place-items: end center;
		animation: drop 0.6s var(--spring) both;
		perspective: 600px;
	}
	@keyframes drop {
		from {
			transform: translateY(-60px) scale(0.6);
			opacity: 0;
		}
	}
	.s-closed:not(:disabled) .box {
		animation: idle 2.2s ease-in-out infinite;
		animation-delay: inherit;
	}
	.s-closed:not(:disabled):hover .box {
		animation: rattle 0.35s ease-in-out infinite;
	}
	.s-closed:not(:disabled):active .box {
		transform: scale(0.92);
	}
	@keyframes idle {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}
	@keyframes rattle {
		0%,
		100% {
			transform: rotate(-3deg) scale(1.06);
		}
		50% {
			transform: rotate(3deg) scale(1.06);
		}
	}
	.box {
		position: relative;
		width: 82%;
		height: 70%;
		transition: transform 0.4s var(--spring), opacity 0.4s, filter 0.4s;
	}
	.base,
	.lid {
		position: absolute;
		left: 0;
		right: 0;
		background: linear-gradient(180deg, #b8692f, #8b4a1c);
		border: 4px solid #5e2f0e;
	}
	.base {
		bottom: 0;
		height: 62%;
		border-radius: 8px 8px 14px 14px;
		box-shadow: inset 0 -8px 0 rgba(0, 0, 0, 0.18);
	}
	.lid {
		top: 0;
		height: 42%;
		border-radius: 40% 40% 6px 6px / 60% 60% 6px 6px;
		transform-origin: 50% 100%;
		z-index: 2;
		transition: transform 0.55s var(--spring);
		background: linear-gradient(180deg, #d4813d, #a65a24);
	}
	.band {
		position: absolute;
		left: 50%;
		width: 18%;
		top: -4px;
		bottom: -4px;
		transform: translateX(-50%);
		background: linear-gradient(180deg, #ffe07a, #e0a800);
		border: 3px solid #a87800;
		border-radius: 4px;
	}
	.lock {
		position: absolute;
		left: 50%;
		top: 10%;
		width: 26%;
		height: 34%;
		transform: translateX(-50%);
		background: linear-gradient(180deg, #ffe07a, #e0a800);
		border: 3px solid #a87800;
		border-radius: 6px;
		z-index: 3;
	}
	.lock::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 30%;
		width: 22%;
		height: 40%;
		transform: translateX(-50%);
		background: #5e2f0e;
		border-radius: 3px 3px 1px 1px;
	}
	.s-open .lid,
	.s-other .lid {
		transform: translateY(-20%) rotateX(110deg);
	}
	.s-open .box {
		animation: openbounce 0.5s var(--spring);
	}
	@keyframes openbounce {
		0% {
			transform: scale(1) rotate(0);
		}
		30% {
			transform: scale(1.12, 0.88) rotate(-4deg);
		}
		60% {
			transform: scale(0.95, 1.08) rotate(3deg);
		}
		100% {
			transform: scale(1);
		}
	}
	.s-other .box,
	.s-dim .box {
		filter: grayscale(0.4) brightness(0.85);
		transform: scale(0.85);
	}
	.rays {
		position: absolute;
		inset: -20%;
		border-radius: 50%;
		background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--rc) 70%, white) 0 12deg, transparent 12deg 30deg);
		mask: radial-gradient(circle, black 20%, transparent 65%);
		opacity: 0;
		transform: scale(0.4);
		transition: opacity 0.4s, transform 0.6s var(--spring);
		pointer-events: none;
	}
	.s-open .rays {
		opacity: 0.9;
		transform: scale(1);
		animation: spin 8s linear infinite;
	}
	.s-open.t-bad .rays {
		background: repeating-conic-gradient(from 0deg, #ff8a95 0 12deg, transparent 12deg 30deg);
	}
	.reward {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		z-index: 5;
		pointer-events: none;
		animation: rewardpop 0.6s var(--spring) 0.15s both;
	}
	.s-other .reward {
		animation-delay: 0s;
		opacity: 0.85;
		transform: scale(0.8);
	}
	@keyframes rewardpop {
		from {
			transform: translateY(40px) scale(0.2);
			opacity: 0;
		}
	}
	.ricon {
		font-size: clamp(2.6rem, 9vw, 4.2rem);
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.2));
	}
	.s-other .ricon {
		font-size: clamp(1.6rem, 6vw, 2.6rem);
	}
	.rtitle {
		background: var(--rc);
		color: #fff;
		font-weight: 700;
		padding: 4px 12px;
		border-radius: 999px;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15);
		font-size: clamp(0.85rem, 3.2vw, 1.15rem);
		white-space: nowrap;
	}
	.s-other .rtitle {
		font-size: 0.8rem;
	}
	.chest:disabled {
		cursor: default;
	}
</style>
