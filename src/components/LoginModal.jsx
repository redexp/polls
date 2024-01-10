import {batch, createEffect} from "solid-js";
import {Switch, Match} from 'solid-js/web';
import {createMutable} from "solid-js/store";
import Modal, {Header, Body, Footer} from './Modal.jsx';
import appState, {setAppState} from './appState.jsx';
import {state as testModal} from './BankIdTestModal.jsx';

export const state = createMutable({
	open: false,
	callbacks: [],
});

export default function LoginModal() {
	createEffect(() => {
		if (state.open || state.callbacks.length === 0) return;

		for (const cb of state.callbacks) {
			cb(appState.bankId);
		}

		state.callbacks.splice(0, state.callbacks.length);
	});

	return (
		<Modal open={state.open}>
			<Header>Авторизація</Header>

			<Body>
				<LoginButton onClick={() => {
					state.open = false;
				}}/>
			</Body>

			<Footer>
				<button
					onClick={() => state.open = false}
					type="button"
					class="btn btn-secondary"
				>Закрити</button>
			</Footer>
		</Modal>
	);
}

export function LoginButton({onClick}) {
	return (
		<button
			type="button"
			class="btn btn-light btn-lg"
			onClick={() => {
				if (appState.bankId) {
					setAppState({
						name: '',
						bankId: '',
					});

					if (onClick) {
						onClick();
					}

					return;
				}

				testModal.open = true;
				testModal.onLogin = (name) => {
					if (name) {
						setAppState({
							name,
							bankId: String(Math.random()),
						});
					}

					if (onClick) {
						onClick();
					}
				};
			}}
		>
			<Switch>
				<Match when={!appState.bankId}>
					<span class="me-2">Увійти за допомогою</span>
				</Match>
				<Match when={!!appState.bankId}>
					<span class="me-2">Вийти з</span>
				</Match>
			</Switch>

			<img src="/bankid.png" height={30} alt="BankID" style={{"vertical-align": "top"}}/>
		</button>
	);
}

/**
 * @param {function(valid: boolean): void} cb
 */
export function onAuth(cb) {
	if (appState.bankId) {
		cb(true);
		return;
	}

	batch(() => {
		state.open = true;
		state.callbacks.push(cb);
	});
}