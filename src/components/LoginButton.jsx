import appState, {setAppState} from "@lib/appState.js";
import {createMutable} from "solid-js/store";

export const state = createMutable({
	redirectParams: ''
});

export function setRedirectParams(params) {
	state.redirectParams = (new URLSearchParams(params)).toString();
}

/**
 * @param {{confirm?: boolean, onLogout?: function}} props
 * @return {Node}
 * @constructor
 */
export default function LoginButton(props) {
	let url = '/bankid/auth';

	if (location.hostname === 'localhost') {
		url = 'http://localhost:8000' + url;
	}

	return (
		<a
			href={url + (state.redirectParams ? '?' : '') + state.redirectParams}
			target="_blank"
			class="btn btn-light btn-lg"
			onClick={(e) => {
				if (!appState.jwt) return;

				e.preventDefault();

				setAppState({
					jwt: '',
				});

				if (props.onLogout) {
					props.onLogout();
				}
			}}
		>
			{!appState.jwt ?
				<span class="me-2">
					{props.confirm ?
						`Погодитись та увійти з` :
						`Увійти за допомогою`
					}
				</span>
				:
				<span class="me-2">Вийти з</span>
			}

			<img src="/bankid.png" width={80} alt="BankID" style={{"margin-top": '-5px'}}/>
		</a>
	);
}