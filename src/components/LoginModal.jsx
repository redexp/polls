import {batch} from "solid-js";
import {createMutable} from "solid-js/store";
import Modal, {Header, Body, Footer} from './Modal.jsx';
import LoginButton, {setRedirectParams} from './LoginButton.jsx';
import appState from '@lib/appState.js';

export const state = createMutable({
	open: false,
	answerText: '',
	answerChecked: true,
	callbacks: [],
});

export default function LoginModal() {
	const flush = (data) => {
		for (const cb of state.callbacks) {
			cb(data);
		}

		state.callbacks.splice(0, state.callbacks.length);
	};

	const onResolve = () => {
		flush(appState.jwt);
		state.open = false;
	};

	const onReject = () => {
		flush(false);
		state.open = false;
	};

	return (
		<Modal open={state.open}>
			{!appState.jwt &&
			<Header>
				Ідентифікація
			</Header>}

			<Body>
				<p>
					{state.answerChecked ?
						`Ваша відповідь` :
						`Ви відмовляєтесь від відповіді`
					}
				</p>

				<div class="alert alert-light">
					{state.answerText}
				</div>

				Беручи участь в цьому опитуванні Ви погоджуюєтесь на
				зберігання та обробку ваших даних (<strong>ім'я</strong>, <strong>вік</strong> та <strong>стать</strong>)
				виключно Соціологічною службою Черкаського інституту міста,
				які необхідні для подальшого аналізу та виведення результатів на цьому сайті.
			</Body>

			<Footer>
				{appState.jwt ?
					<button
						onClick={onResolve}
						type="button"
						class="btn btn-primary"
					>Погоджуюсь</button>
					:
					<LoginButton
						confirm={true}
						onLogin={onResolve}
						onLogout={onReject}
					/>
				}

				<button
					onClick={onReject}
					type="button"
					class="btn btn-secondary"
				>Відмовитись</button>
			</Footer>
		</Modal>
	);
}

/**
 * @param {any} answerText
 * @param {{poll?: string, value?: string}} params
 * @param {function(jwt: string): void} cb
 */
export function onConfirmAndAuth(answerText, params, cb) {
	if (params.poll && location.pathname === '/polls/' + params.poll) {
		params = {...params, poll_page: 1}
	}

	batch(() => {
		setRedirectParams(params);

		state.open = true;
		state.answerText = answerText;
		state.callbacks.push(cb);
	});
}