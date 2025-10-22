import {showModal, showInfoModal} from './modal.ts';
import {hasAuth, getJwt} from './auth.ts';
import {byId, setLinkParams} from './dom.ts';
import ajax from './ajax';

const PENDING_KEY = 'pending_for_auth';

export default function answerConfirm(form: HTMLFormElement): Promise<boolean> {
	return new Promise((done, fail) => {
		if (!isValidAnswers(form)) {
			fail();
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

		let pending_id: string;

		if (!hasAuth()) {
			pending_id = storeAnswer(form);
			setLinkParams('#confirm-auth-btn', {state: pending_id});
		}

		const confirmBtn = byId<HTMLButtonElement>('confirm-btn');

		modal.loadingBtn = confirmBtn;

		confirmBtn.onclick = function () {
			const p = sendAnswer(form);

			modal.loading(p);

			p.then(() => {
				delete modal.onClose;

				confirmBtn.classList.add('btn-success');
				confirmBtn.classList.remove('btn-primary');

				setTimeout(() => {
					modal.close();

					confirmBtn.classList.remove('btn-success');
					confirmBtn.classList.add('btn-primary');

					done(true);
				}, 2000);
			});
		};
	});
}

export function getPollData(form: HTMLFormElement): {public: boolean, expire?: Date, active: boolean} {
	const json = form.querySelector('script[type="text/json"]')!.innerHTML;
	const data = JSON.parse(json);

	data.public = !!data.public;

	if (data.expire) {
		data.expire = new Date(data.expire);
	}

	data.active = !data.expire || data.expire.valueOf() > Date.now();

	return data;
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

	for (const textArea of getTextAreas(form)) {
		textArea.value = data.texts?.hasOwnProperty(textArea.name) ? data.texts[textArea.name] : '';
	}

	removePendingData();

	return form;
}

function isValidAnswers(form: HTMLFormElement): boolean {
	const groups = getInputsGroups(form);
	const scrollTo = (node: HTMLInputElement) => {
		node.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
		});
	};

	for (const group of groups.values()) {
		if (!group.max) continue;

		if (group.checkedCount > group.max) {
			scrollTo(group.inputs[0]);
			showInfoModal(`Ви вибрали більше ${group.max} відповідей`);
			return false;
		}
	}

	let hasInvalid = false;

	for (const group of groups.values()) {
		const isInvalid = group.checkedCount === 0;

		if (isInvalid) {
			for (const inp of group.inputs) {
				inp.classList.add('is-invalid');
			}
		}

		if (!hasInvalid && isInvalid) {
			hasInvalid = isInvalid;
			scrollTo(group.inputs[0]);
		}
	}

	if (hasInvalid) {
		const count = Array.from(groups.values()).reduce((sum, g) => sum + (g.checkedCount > 0 ? 0 : 1), 0);
		showInfoModal(`Ви не відповіли на ${count} ${count < 5 ? 'питання' : 'питань'}`);
		return false;
	}

	return true;
}

export function createAnswerData(form: HTMLFormElement): AnswerData {
	const values = (
		getInputs(form)
		.filter(input => input.checked)
		.map(input => input.value)
	);

	const texts = (
		getTextAreas(form)
		.filter(el => values.includes(el.name))
		.reduce((sum, el) => {
			sum[el.name] = el.value;
			return sum;
		}, {})
	);

	return {
		poll_id: form.id,
		values,
		texts,
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

export function createSuccessText(form: HTMLFormElement) {
	const {expire} = getPollData(form);

	let msg = `Дякуємо за позицію та участь в опитуванні!`;

	if (expire) {
		const f = () => expire.toLocaleDateString('uk', {day: 'numeric', month: 'long'});

		expire.setDate(expire.getDate() - 1);
		msg += `<br>Воно триватиме до <strong>${f()}</strong> включно.`
		expire.setDate(expire.getDate() + 2);
		msg += ` Ознайомитись із результатами можна буде <strong>${f()}</strong> тут або на наших сторінках у соцмережах.`
	}

	return msg;
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
	return Array.from(form.querySelectorAll<HTMLInputElement>('input[name][value]'));
}

function getTextAreas(form: HTMLFormElement): HTMLTextAreaElement[] {
	return Array.from(form.querySelectorAll<HTMLTextAreaElement>('textarea[name]'));
}

type InputsGroup = {
	inputs: HTMLInputElement[],
	checkedCount: number,
	min?: number,
	max?: number,
};

export function getInputsGroups(form: HTMLFormElement): Map<string, InputsGroup> {
	const inputs = getInputs(form);
	const groups = new Map<string, InputsGroup>();

	for (const input of inputs) {
		const {group} = input.dataset;

		if (!group) continue;

		let g = groups.get(group);

		if (!g) {
			g = {
				inputs: [],
				checkedCount: 0,
			};

			if (input.dataset.range) {
				const [min, max] = input.dataset.range.split('-').map(v => Number(v));
				g.min = min;
				g.max = max;
			}

			groups.set(group, g);
		}

		g.inputs.push(input);

		if (input.checked) {
			g.checkedCount++;
		}
	}

	return groups;
}

export type AnswerData = {
	poll_id: string,
	values: string[],
	texts?: {[value: string]: string},
};

export type PendingData = AnswerData & {
	id: string,
};