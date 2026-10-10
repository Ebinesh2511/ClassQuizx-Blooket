<script>
	import { fade } from 'svelte/transition';
	import { route } from './lib/router.svelte.js';
	import Background from './lib/Background.svelte';
	import Toasts from './lib/Toasts.svelte';
	import { isMuted, setMuted } from './lib/sfx.js';
	import Home from './views/Home.svelte';
	import Play from './views/Play.svelte';
	import HostSetup from './views/HostSetup.svelte';
	import Host from './views/Host.svelte';

	let muted = $state(isMuted());
	const view = $derived(
		route.path.startsWith('/play') ? 'play' : route.path === '/host/live' ? 'host' : route.path.startsWith('/host') ? 'setup' : 'home'
	);
</script>

<Background />
<Toasts />
<button class="mute" title={muted ? 'Sound off' : 'Sound on'} onclick={() => setMuted((muted = !muted))}>{muted ? '🔇' : '🔊'}</button>

{#key view}
	<main in:fade={{ duration: 250, delay: 150 }} out:fade={{ duration: 150 }}>
		{#if view === 'play'}
			<Play />
		{:else if view === 'host'}
			<Host />
		{:else if view === 'setup'}
			<HostSetup />
		{:else}
			<Home />
		{/if}
	</main>
{/key}

<style>
	main {
		position: relative;
		z-index: 1;
		min-height: 100dvh;
	}
	.mute {
		position: fixed;
		right: 14px;
		bottom: 14px;
		z-index: 50;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.18);
		backdrop-filter: blur(8px);
		font-size: 1.3rem;
		transition: transform 0.2s var(--spring);
	}
	.mute:hover {
		transform: scale(1.12) rotate(-8deg);
	}
</style>
