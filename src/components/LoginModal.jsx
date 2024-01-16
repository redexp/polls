import {batch} from "solid-js";
import {createMutable} from "solid-js/store";
import Modal, {Header, Body, Footer} from './Modal.jsx';
import appState, {setAppState} from './appState.jsx';
import {state as testModal} from './BankIdTestModal.jsx';

export const state = createMutable({
	open: false,
	confirm: false,
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
		flush(appState.bankId);
		state.open = false;
	};

	const onReject = () => {
		flush(false);
		state.open = false;
	};

	return (
		<Modal open={state.open}>
			{!appState.bankId &&
			<Header>
				Автентифікація
			</Header>}

			<Body>
				Беручи участь в цьому опитуванні я погоджуюсь на
				зберігання та обробку моїх даних (<strong>ім'я</strong>, <strong>вік</strong> та <strong>стать</strong>)
				Соціологічною службою Черкаського інституту міста,
				необхідних для подальшого аналізу та виведення результатів на цьому сайті.
			</Body>

			<Footer>
				{appState.bankId ?
					<button
						onClick={onResolve}
						type="button"
						class="btn btn-primary"
					>Погоджуюсь</button>
					:
					<LoginButton
						confirm={true}
						onClick={onResolve}
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

export function LoginButton(props) {
	return (
		<button
			type="button"
			class="btn btn-light btn-lg"
			onClick={() => {
				const {onClick} = props;

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
			{!appState.bankId ?
				<span class="me-2">
					{props.confirm ?
						`Погодитись та увійти з` :
						`Увійти за допомогою`
					}
				</span> :
				<span class="me-2">Вийти з</span>
			}

			<img src="/bankid.png" width={80} alt="BankID" style={{"margin-top": '-5px'}}/>
		</button>
	);
}

/**
 * @param {function(bankId: string): void} cb
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

/**
 * @param {function(bankId: string): void} cb
 */
export function onConfirmAndAuth(cb) {
	batch(() => {
		state.open = true;
		state.callbacks.push(cb);
	});
}