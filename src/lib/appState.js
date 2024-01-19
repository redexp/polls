import {createMutable} from 'solid-js/store';
import {isServer} from "solid-js/web";

const appState = createMutable({
	jwt: getState('jwt'),
	reloadStatsSignal: Math.random(),
});

if (!isServer) {
	const url = new URL(location.href);

	if (url.searchParams.has('jwt')) {
		setAppState({jwt: url.searchParams.get('jwt')});
	}

	window.addEventListener('storage', (e) => {
		if (e.key !== 'jwt') return;

		appState.jwt = e.newValue;
	});
}

export default appState;

export function setAppState({jwt}) {
	localStorage.setItem('jwt', jwt);

	appState.jwt = jwt;
}

export function reloadStats() {
	appState.reloadStatsSignal = Math.random();
}

function getState(name) {
	return typeof localStorage !== 'undefined' ? localStorage.getItem(name) : '';
}