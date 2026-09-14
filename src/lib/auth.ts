import ajax from './ajax';

const KEY = 'jwt';

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
		data = JSON.parse(decodeBase64Url(jwt.split('.')[1]));
	}
	catch (_err) {
		return false;
	}

	if (!data) return false;

	if (typeof data.exp === 'number') {
		return data.exp - Date.now() / 1000 > 0;
	}

	return true;
}

/**
 * Частини JWT — base64url, а не base64: замість `+` і `/` там `-` і `_`, і без
 * `=` у кінці. Голий atob на такому падає, щойно в корисному навантаженні
 * трапляється байт, що дає ці символи — а з кириличним імʼям це майже завжди.
 * До того ж atob повертає латиницю-1, тому UTF-8 треба розкодувати окремо.
 */
function decodeBase64Url(text: string): string {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
	const bytes = Uint8Array.from(atob(padded), ch => ch.charCodeAt(0));

	return new TextDecoder().decode(bytes);
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