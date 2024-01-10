import {batch} from 'solid-js';
import {createMutable} from 'solid-js/store';

const appState = createMutable({
	name: getState('name') || '',
	bankId: getState('bankId') || '',
	reloadStatsSignal: Math.random(),
});

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