function read() {
	return { path: location.pathname, query: new URLSearchParams(location.search) };
}

export const route = $state(read());

export function navigate(to, replace = false) {
	history[replace ? 'replaceState' : 'pushState']({}, '', to);
	Object.assign(route, read());
	window.scrollTo({ top: 0 });
}

window.addEventListener('popstate', () => Object.assign(route, read()));
