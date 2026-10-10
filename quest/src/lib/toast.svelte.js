export const toasts = $state([]);
let n = 0;
export function toast(text, { icon = '💬', kind = 'info', ms = 3200 } = {}) {
	const id = ++n;
	toasts.push({ id, text, icon, kind });
	setTimeout(() => {
		const i = toasts.findIndex((t) => t.id === id);
		if (i >= 0) toasts.splice(i, 1);
	}, ms);
}
