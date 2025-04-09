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
				{state.answerChecked ?
					<p>Ваша відповідь</p> :
					<p>Ви <strong>відмовляєтесь</strong> від відповіді</p>
				}

				<div class="alert alert-light">
					{state.answerText}
				</div>

				Беручи участь в цьому опитуванні Ви погоджуюєтесь на
				зберігання та обробку ваших даних, а саме:
				<ul>
					<li><strong>Повне ім'я</strong>, яке можна буде знайти під цією відповіддю</li>
					<li><strong>Вік</strong> та <strong>стать</strong>, які зберігаються без привʼязки до вашого імені</li>
					<li>
						<strong>Plus Code місця</strong> у якому знаходиться ваша адреса реєстрації, який також зберігається окремо від імені, але разом з віком та статтю.
						&nbsp;
						<button
							onClick={(e) => e.target.nextElementSibling.classList.toggle('d-none')}
							type="button"
							class="btn btn-light btn-sm"
						>Детальніше про Plus Code</button>

						<div class="d-none my-2">
							<a href="https://uk.wikipedia.org/wiki/Відкритий_код_розташування" target="_blank">Plus Code ↗</a> - це одна з клітинок на мапі розміром приблизно 180 на 300 метрів, посеред якої знаходиться ваша адреса реєстрації.
							Ось приклад такої клітинки, на якій знаходиться <a href="https://plus.codes/8GXJC3V5+" target="_blank">центральна площа міста Черкаси ↗</a>.
							Plus Code цієї площі буде записаний як <strong>8GXJC3V5+</strong>.
							Погодьтесь, маючи інформацію про цю клітинку, неможливо сказати, що мається на увазі - чи площа, чи сквер, чи одна з жилих будівель.
							Таким чином ми повністю анонімізуєм вашу персональну адресу, але маєм інформацію, щоб робити статистичні висновки.
						</div>
					</li>
				</ul>
				Ваші данні обробляються виключно Соціологічною службою Черкаського інституту міста,
				які необхідні для подальшого статистичного аналізу та виведення його результатів на цьому сайті.
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
 * @param {boolean} answerChecked
 * @param {{poll?: string, value?: string}} params
 * @param {function(jwt: string): void} cb
 */
export function onConfirmAndAuth(answerText, answerChecked, params, cb) {
	if (params.poll && location.pathname === '/polls/' + params.poll) {
		params = {...params, poll_page: 1}
	}

	batch(() => {
		setRedirectParams(params);

		state.open = true;
		state.answerText = answerText;
		state.answerChecked = answerChecked;
		state.callbacks.push(cb);
	});
}