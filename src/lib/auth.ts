import ajax from './ajax';

/**
 * @returns {{auth_token: string|null, state: string|null}}
 */
export function getAuthParams() {
	const url = new URL(location.href);
	const params = url.searchParams;
	const auth_token = params.get('auth_token');
	const state = params.get('state');

	if (auth_token || state) {
		params.delete('auth_token');
		params.delete('state');
		history.pushState({}, '', url);
	}

	return {auth_token, state};
}

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

export async function isAdmin(): Promise<boolean> {
	if (!hasAuth()) return false;

	return ajax('/api/bankid/is-admin', {jwt: getJwt()}).catch(() => false);
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