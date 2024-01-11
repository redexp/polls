import {addNotification} from './Notifications.jsx';

export default async function ajax(url, body) {
	const dev = location.hostname === 'localhost';

	const base = (
		dev ?
			'http://localhost:8000' :
			location.origin
	);

	const headers = {
		'Content-Type': 'application/json',
	};

	if (dev) {
		headers['Origin'] = 'http://localhost:4321';
	}

	return fetch(base + url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	})
	.then(async (res) => {
		const data = await res.json().catch(() => null);

		if (res.ok) return data;

		if (data && data.message && typeof data.message === 'string') {
			addNotification({
				type: 'error',
				text: data.message,
			});
		}

		throw res;
	});
}