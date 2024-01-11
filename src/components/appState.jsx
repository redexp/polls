import {batch} from 'solid-js';
import {createMutable} from 'solid-js/store';
import {isServer} from "solid-js/web";

const appState = createMutable({
	name: '',
	bankId: '',
	reloadStatsSignal: Math.random(),
});

if (!isServer) {
	requestAnimationFrame(() => {
		if (!getState('bankId')) return;

		setAppState({
			bankId: getState('bankId'),
			name: getState('name'),
		});
	});
}

export default appState;

export function setAppState({bankId, name}) {
	localStorage.setItem('bankId', bankId);
	localStorage.setItem('name', name);

	batch(() => {
		appState.bankId = bankId;
		appState.name = name;
	});
}

export function reloadStats() {
	appState.reloadStatsSignal = Math.random();
}

function getState(name) {
	return typeof localStorage !== 'undefined' && localStorage.getItem(name);
}