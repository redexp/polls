import * as notify from './notify.js';

export default async function ajax(url, body) {
	return request({
		method: 'POST',
		url,
		body,
	})
	.then(async (res) => {
		const data = await res.json().catch(() => null);

		if (res.ok) return data;

		if (typeof data?.message === 'string') {
			notify.error(data.message);
		}

		throw res;
	});
}

/**
 * Запит з тілом multipart. JWT іде в заголовку, а не в тілі, як у решти
 * запитів: тіло тут — не JSON, і сервер розбирає його вже після перевірки.
 *
 * @param {string} url
 * @param {FormData} body
 * @param {string|null} jwt
 * @returns {Promise<any>}
 */
export async function postForm(url, body, jwt) {
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'authorization': 'Bearer ' + (jwt || ''),
			'x-requested-with': 'XMLHttpRequest',
		},
		body,
	});

	const data = await res.json().catch(() => null);

	if (res.ok) return data;

	if (typeof data?.message === 'string') {
		notify.error(data.message);
	}

	throw res;
}

/**
 * @param {"POST" | "GET"} method
 * @param {string} url
 * @param {Object} [qs]
 * @param {Object} [headers]
 * @param {Object} [body]
 * @param {...*} [params]
 * @return {Promise<any>}
 */
async function request({method, url, qs, headers = {}, body, ...params}) {
	if (qs) {
		url += '?' + (new URLSearchParams(qs)).toString()
	}

	if (body && !headers['content-type']) {
		headers['content-type'] = 'application/json';
	}

	if (!headers['x-requested-with']) {
		headers['x-requested-with'] = 'XMLHttpRequest';
	}

	return fetch(url, {
		method,
		headers,
		body: JSON.stringify(body),
		...params,
	});
}