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