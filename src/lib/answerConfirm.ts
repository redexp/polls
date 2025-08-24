import {showModal, showInfoModal} from './modal.ts';
import type {Modal} from './modal.ts';
import {hasAuth, getJwt} from './auth.ts';
import {byId} from './dom.ts';
import ajax from './ajax';

const PENDING_KEY = 'pending_for_auth';

export default function answerConfirm(form: HTMLFormElement): Promise<boolean> {
	return new Promise((done) => {
		if (createAnswerData(form).values.length === 0) {
			showInfoModal('Ви не вибрали жодної відповіді');
			done(false);
			return;
		}

		const modal = showModal('answer-confirm');

		modal.onClose = () => {
			const data = getPendingData();

			if (data?.id === pending_id) {
				removePendingData();
			}

			done(false);
		};

		const authBtn = byId<HTMLAnchorElement>('confirm-auth-btn');

		let pending_id: string;

		if (!hasAuth()) {
			pending_id = storeAnswer(form);
			const url = new URL(authBtn.href);
			url.searchParams.set('state', pending_id);
			authBtn.href = url.toString();
		}

		const confirmBtn = byId<HTMLButtonElement>('confirm-btn');

		modal.loadingBtn = confirmBtn;

		confirmBtn.onclick = function () {
			const p = sendAnswer(form);

			modal.loading(p);

			p.then(() => {
				delete modal.onClose;
				modal.close();
				done(true);
			});

			p.catch(() => {
				done(false);
			});
		};
	});
}

export function sendAnswer(form: HTMLFormElement): Promise<void> {
	return ajax('/api/answers', {
		...createAnswerData(form),
		jwt: getJwt(),
	});
}

export async function tryRestorePendingAnswer(pending_id: string): Promise<HTMLFormElement|null> {
	const data = getPendingData();

	if (!data || data.id !== pending_id) return null;

	const form = byId<HTMLFormElement>(data.poll_id);

	if (!form) return null;

	for (const input of getInputs(form)) {
		input.checked = data.values.includes(input.value);
	}

	removePendingData();

	return form;
}

export function createAnswerData(form: HTMLFormElement): AnswerData {
	return {
		poll_id: form.id,
		values: (
			getInputs(form)
			.filter(input => input.checked)
			.map(input => input.value)
		),
	};
}

export function storeAnswer(form: HTMLFormElement): string {
	const data: PendingData = {
		id: uniqId(),
		...createAnswerData(form),
	};

	sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));

	return data.id;
}

function getPendingData(): PendingData|null {
	const json = sessionStorage.getItem(PENDING_KEY);

	return json && JSON.parse(json);
}

function removePendingData() {
	sessionStorage.removeItem(PENDING_KEY);
}

function uniqId(): string {
	return String(Math.random()).replace('0.', '');
}

function getInputs(form: HTMLFormElement): HTMLInputElement[] {
	return Array.from(form.querySelectorAll<HTMLInputElement>('input'));
}

export type AnswerData = {
	poll_id: string,
	values: string[],
};

export type PendingData = AnswerData & {
	id: string,
};

export type ConfirmModal = Modal & {};