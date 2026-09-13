import ajax from './ajax';

const KEY = 'jwt';
const EXP_TIMEOUT = 60 * 60 * 24 * 7; // 1Week

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
	return sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
}

export function removeJwt() {
	sessionStorage.removeItem(KEY);
	localStorage.removeItem(KEY);
	trigger();
}

export function hasAuth(): boolean {
	const jwt = getJwt();

	if (typeof jwt !== 'string') return false;

	let data;

	try {
		data = JSON.parse(atob(jwt.split('.')[0]));
	}
	catch (_err) {
		return false;
	}

	return (
		typeof data.exp !== 'number' ||
		Date.now() / 1000 - data.exp < EXP_TIMEOUT
	);
}

export async function isAdmin(): Promise<boolean> {
	if (!hasAuth()) return false;

	return ajax('/api/bankid/is-admin', {jwt: getJwt()}).catch(() => false);
}

export async function retrieveJwt(auth_token: string, remember = false) {
	const {jwt} = await ajax('/api/bankid/jwt', {auth_token});

	if (remember) {
		localStorage.setItem(KEY, jwt);
	}
	else {
		sessionStorage.setItem(KEY, jwt);
	}

	trigger();
}

const listeners: Array<(state: boolean) => void> = [];

export function onChange(cb: (state: boolean) => void) {
	cb(hasAuth());

	listeners.push(cb);

	window.addEventListener('storage', function (e) {
		if (e.key === KEY) {
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