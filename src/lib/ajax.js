import {addNotification} from '@components/Notifications.jsx';

async function ajax(url, body) {
	return request({
		method: 'POST',
		url,
		body,
	})
	.then(async (res) => {
		const data = await res.json().catch(() => null);

		if (res.ok) return data;

		if (typeof data?.message === 'string') {
			addNotification({
				type: 'error',
				text: data.message,
			});
		}

		throw res;
	});
}

export default ajax;

/**
 * @param {"POST" | "GET"} method
 * @param {string} url
 * @param {Object} [qs]
 * @param {Object} [headers]
 * @param {Object} [body]
 * @param {...*} [params]
 * @return {Promise<any>}
 */
export async function request({method, url, qs, headers = {}, body, ...params}) {
	const dev = location.hostname === 'localhost';

	const base = (
		dev ?
			'http://localhost:8000' :
			location.origin
	);

	if (qs) {
		url += '?' + (new URLSearchParams(qs)).toString()
	}

	if (body && !headers['content-type']) {
		headers['content-type'] = 'application/json';
	}

	if (!headers['x-requested-with']) {
		headers['x-requested-with'] = 'XMLHttpRequest';
	}

	return fetch(base + url, {
		method,
		headers,
		body: JSON.stringify(body),
		...params,
	});
}