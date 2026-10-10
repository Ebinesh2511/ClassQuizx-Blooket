import { io } from 'socket.io-client';

export const socket = io({ transports: ['websocket', 'polling'] });

/** emit with ack as a promise */
export function call(event, data = {}, timeout = 8000) {
	return new Promise((resolve) => {
		socket.timeout(timeout).emit(event, data, (err, res) => {
			resolve(err ? { error: 'Connection hiccup, try again' } : res);
		});
	});
}

/** server clock offset so timers line up on every device */
let offset = 0;
export function syncClock(serverNow) {
	if (serverNow) offset = serverNow - Date.now();
}
export const now = () => Date.now() + offset;
