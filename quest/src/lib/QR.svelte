<script>
	import QRCode from 'qrcode';
	let { text, size = 220 } = $props();
	let src = $state('');
	$effect(() => {
		QRCode.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b1a5e', light: '#ffffff' } }).then((u) => (src = u));
	});
</script>

<div class="qr" style="--s:{size}px">
	{#if src}<img {src} alt="QR code to join the game" />{/if}
	<span class="logo">🦊</span>
</div>

<style>
	.qr {
		position: relative;
		width: var(--s);
		height: var(--s);
		padding: 10px;
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 6px 0 #d6ccf5;
		animation: pop-in 0.6s var(--spring) both;
	}
	img {
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: pixelated;
	}
	.logo {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: #fff;
		border-radius: 12px;
		padding: 2px 4px;
		font-size: calc(var(--s) * 0.12);
	}
</style>
