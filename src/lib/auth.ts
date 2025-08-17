import ajax from './ajax';

export function getJwt(): string|null {
	return sessionStorage.getItem('jwt');
}

export function removeJwt() {
	sessionStorage.removeItem('jwt');
	trigger();
}

export function hasAuth(): boolean {
	return !!getJwt();
}

export async function retrieveJwt(auth_token: string) {
	const {jwt} = await ajax('/api/bankid/jwt', {auth_token});

	sessionStorage.setItem('jwt', jwt);
	trigger();
}

const listeners: Array<(state: boolean) => void> = [];

export function onChange(cb: (state: boolean) => void) {
	cb(hasAuth());

	listeners.push(cb);

	window.addEventListener('storage', function (e) {
		if (e.key === 'jwt') {
			trigger();
		}
	});
}

function trigger() {
	const state = hasAuth();

	for (const cb of listeners) {
		cb(state);
	}
}