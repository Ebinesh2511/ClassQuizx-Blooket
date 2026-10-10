<script>
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	let { value = 0, duration = 700 } = $props();
	const t = new Tween(0, { duration: () => duration, easing: cubicOut });
	$effect(() => {
		t.target = value;
	});
</script>

{Math.round(t.current).toLocaleString()}
