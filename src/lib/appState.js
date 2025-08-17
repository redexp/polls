import {createMutable} from 'solid-js/store';
import {isServer} from "solid-js/web";
// import ajax from './ajax.js';

const STORAGE = !isServer && sessionStorage;

const appState = createMutable({
	jwt: getState('jwt'),
	reloadStatsSignal: Math.random(),
});

// if (!isServer) {
// 	const url = new URL(location);
// 	const {searchParams: qs} = url;
//
// 	if (qs.has('auth_token')) {
// 		ajax('/bankid/jwt', {auth_token: qs.get('auth_token')}).then(function (data) {
// 			if (!data || !data.jwt) return;
//
// 			setAppState(data);
// 		});
//
// 		qs.delete('auth_token');
//
// 		history.pushState({}, '', url);
// 	}
//
// 	window.addEventListener('storage', (e) => {
// 		if (e.key !== 'jwt') return;
//
// 		appState.jwt = e.newValue;
// 	});
// }

export default appState;

export function setAppState({jwt = ''}) {
	STORAGE.setItem('jwt', jwt);

	appState.jwt = jwt;
}

export function reloadStats() {
	appState.reloadStatsSignal = Math.random();
}

function getState(name) {
	return STORAGE && STORAGE.getItem(name) || '';
}