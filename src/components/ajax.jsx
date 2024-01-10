import {addNotification} from './Notifications.jsx';

export default async function ajax(url, body) {
	return fetch('http://localhost:8000' + url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Origin': 'http://localhost:4321',
		},
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