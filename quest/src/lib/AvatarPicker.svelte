<script>
	import Avatar from './Avatar.svelte';
	import { ANIMALS, COLORS, HATS, randomAvatar } from './avatars.js';
	import { sfx } from './sfx.js';
	let { avatar = $bindable(), onchange = null } = $props();
	let spinning = $state(false);
	let tab = $state('animal');

	function set(patch) {
		avatar = { ...avatar, ...patch };
		sfx.pop();
		onchange?.(avatar);
	}
	function reroll() {
		spinning = true;
		sfx.chest();
		let n = 0;
		const iv = setInterval(() => {
			avatar = randomAvatar();
			if (++n >= 7) {
				clearInterval(iv);
				spinning = false;
				sfx.pop();
				onchange?.(avatar);
			}
		}, 70);
	}
</script>

<div class="picker">
	<div class="hero">
		<div class="stage" class:spinning>
			{#key avatar.animal + '-' + avatar.color + '-' + avatar.hat}
				<div class="pop"><Avatar {avatar} size={120} bob={!spinning} /></div>
			{/key}
		</div>
		<button class="btn white dice" class:rolling={spinning} onclick={reroll} disabled={spinning} title="Random avatar">🎲</button>
	</div>

	<div class="tabs">
		<button class:on={tab === 'animal'} onclick={() => (tab = 'animal')}>Animal</button>
		<button class:on={tab === 'color'} onclick={() => (tab = 'color')}>Colour</button>
		<button class:on={tab === 'hat'} onclick={() => (tab = 'hat')}>Hat</button>
	</div>

	<div class="opts">
		{#if tab === 'animal'}
			{#each ANIMALS as [e, n], i}
				<button class="o" class:on={avatar.animal === i} title={n} onclick={() => set({ animal: i })}>{e}</button>
			{/each}
		{:else if tab === 'color'}
			{#each COLORS as c, i}
				<button class="o sw" class:on={avatar.color === i} style="background:{c}" aria-label="colour {i + 1}" onclick={() => set({ color: i })}></button>
			{/each}
		{:else}
			{#each HATS as h, i}
				<button class="o" class:on={avatar.hat === i} onclick={() => set({ hat: i })}>{h || '🚫'}</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: center;
	}
	.hero {
		position: relative;
		padding-top: 18px;
	}
	.stage {
		width: 150px;
		height: 150px;
		display: grid;
		place-items: center;
	}
	.stage.spinning {
		animation: wiggle 0.15s linear infinite;
	}
	.pop {
		animation: pop-in 0.35s var(--spring);
	}
	.dice {
		position: absolute;
		right: -30px;
		bottom: 0;
		width: 54px;
		height: 54px;
		padding: 0;
		font-size: 1.6rem;
		border-radius: 16px;
	}
	.dice.rolling {
		animation: spin 0.4s linear infinite;
	}
	.tabs {
		display: flex;
		background: var(--card-2);
		border-radius: 14px;
		padding: 4px;
	}
	.tabs button {
		padding: 6px 16px;
		border-radius: 10px;
		font-weight: 600;
		color: var(--ink-soft);
		transition: all 0.2s var(--spring);
	}
	.tabs button.on {
		background: #fff;
		color: var(--ink);
		box-shadow: 0 3px 0 #d6ccf5;
	}
	.opts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
		gap: 8px;
		width: 100%;
		max-height: 168px;
		overflow-y: auto;
		padding: 4px;
	}
	.o {
		aspect-ratio: 1;
		border-radius: 14px;
		background: var(--card-2);
		font-size: 1.6rem;
		display: grid;
		place-items: center;
		transition: transform 0.2s var(--spring), box-shadow 0.2s;
	}
	.o:hover {
		transform: scale(1.12) rotate(-6deg);
	}
	.o.on {
		box-shadow: 0 0 0 3px #7c5cff;
		transform: scale(1.08);
		background: #fff;
	}
	.sw.on {
		box-shadow: 0 0 0 3px #fff, 0 0 0 6px #7c5cff;
	}
</style>
