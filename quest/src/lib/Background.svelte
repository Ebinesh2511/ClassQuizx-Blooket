<script>
	// floating emoji + soft blobs; transform-only animations for smoothness
	const items = ['⭐', '🪙', '💎', '🎈', '✨', '🍩', '🎲', '🧩', '🪐', '🍀', '🎯', '🌈'];
	const floats = Array.from({ length: 16 }, (_, i) => ({
		e: items[i % items.length],
		x: (i * 61) % 100,
		d: 14 + ((i * 7) % 12),
		delay: -((i * 3.7) % 20),
		s: 18 + ((i * 13) % 26)
	}));
</script>

<div class="bg" aria-hidden="true">
	<div class="blob b1"></div>
	<div class="blob b2"></div>
	<div class="blob b3"></div>
	{#each floats as f}
		<span class="f" style="left:{f.x}%; font-size:{f.s}px; animation-duration:{f.d}s; animation-delay:{f.delay}s">{f.e}</span>
	{/each}
</div>

<style>
	.bg {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}
	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(60px);
		opacity: 0.5;
		will-change: transform;
	}
	.b1 {
		width: 420px;
		height: 420px;
		background: #ff9de2;
		top: -120px;
		right: -80px;
		animation: drift 18s ease-in-out infinite alternate;
	}
	.b2 {
		width: 360px;
		height: 360px;
		background: #5ee7ff;
		bottom: -120px;
		left: -100px;
		animation: drift 22s ease-in-out infinite alternate-reverse;
	}
	.b3 {
		width: 280px;
		height: 280px;
		background: #ffd76b;
		top: 40%;
		left: 55%;
		opacity: 0.25;
		animation: drift 26s ease-in-out infinite alternate;
	}
	.f {
		position: absolute;
		bottom: -60px;
		opacity: 0.35;
		animation: rise linear infinite;
		will-change: transform;
	}
	@keyframes rise {
		from {
			transform: translateY(0) rotate(0deg);
		}
		to {
			transform: translateY(-115vh) rotate(360deg);
		}
	}
	@keyframes drift {
		from {
			transform: translate(0, 0) scale(1);
		}
		to {
			transform: translate(60px, 40px) scale(1.15);
		}
	}
</style>
