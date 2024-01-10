import Modal, {Header, Body, Footer} from './Modal.jsx';
import {createEffect, createSignal} from "solid-js";
import {createMutable} from 'solid-js/store';

export const state = createMutable({open: false, onLogin: null});

export default function BankIdTestModal() {
	const [error, setError] = createSignal(false);

	let value = '';

	const onSubmit = () => {
		if (!value.trim()) {
			setError(true);
			return;
		}

		state.onLogin(value);

		state.open = false;
		state.onLogin = null;
	};

	const onCancel = () => {
		state.onLogin(null);

		state.open = false;
		state.onLogin = null;
	};

	return (
		<Modal open={state.open}>
			<Header>
				BankID
			</Header>

			<Body>
				<p>На цьому місті має бути вікно справжнього BankID.</p>
				<p>Поточне вікно створено лише задля повторення процесу авторизації.</p>
				<p>Будь ласка, введіть імʼя, яке закріпиться за вами лише на етапі розробки.</p>
				<input
					classList={{
						"form-control": true,
						"is-invalid": error(),
					}}
					autocomplete="name"
					onInput={(e) => value = e.target.value}
				/>
			</Body>

			<Footer>
				<button
					class="btn btn-secondary"
					onClick={onSubmit}
				>
					OK
				</button>

				<button
					class="btn btn-secondary"
					onClick={onCancel}
				>
					Відмінити
				</button>
			</Footer>
		</Modal>
	);
}