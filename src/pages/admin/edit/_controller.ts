import ajax from '@lib/ajax.js';
import {qs, byId, loading} from '@lib/dom.ts';
import {error, success} from '@lib/notify.ts';
import {getAuthParams, getJwt, hasAuth, isAdmin, retrieveJwt} from '@lib/auth.ts';
import {showModal} from '@lib/modal.ts';

type GroupData = {
	body: string,
	min: number,
	max: number|null,
	type?: string,
};

type PollStruct = {
	slug?: string,
	title: string,
	intro: string,
	groups: GroupData[],
	expire: string|null,
	public: boolean,
	draft: boolean,
	votes?: number,
	slugLocked?: boolean,
	proseRange?: boolean,
};

const params = new URLSearchParams(location.search);

/** id опитування, яке редагуємо; null — створення нового */
let currentSlug: string|null = params.get('slug');

/** чи користувач правив поле id руками — тоді автогенерація не втручається */
let slugTouched = !!currentSlug;

const groupsRoot = byId('groups');
const tpl = byId<HTMLTemplateElement>('group-tpl');

const titleInput = byId<HTMLInputElement>('title');
const slugInput = byId<HTMLInputElement>('slug');
const introInput = byId<HTMLTextAreaElement>('intro');
const expireInput = byId<HTMLInputElement>('expire');
const publicInput = byId<HTMLInputElement>('public');
const draftInput = byId<HTMLInputElement>('draft');

const saveBtn = byId<HTMLButtonElement>('save');
const savePublishBtn = byId<HTMLButtonElement>('save-publish');
const previewBtn = byId<HTMLButtonElement>('preview-btn');
const log = byId<HTMLPreElement>('log');

byId<HTMLButtonElement>('add-group').onclick = function () {
	addGroup({body: '', min: 1, max: null});
	relabel();
};

previewBtn.onclick = function () {
	renderPreview().catch(showError);
};

saveBtn.onclick = function () {
	save().then(() => success('Збережено')).catch(showError);
};

savePublishBtn.onclick = function () {
	saveAndPublish().catch(showError);
};

slugInput.oninput = function () {
	slugTouched = true;
};

let slugTimer = 0;

titleInput.oninput = function () {
	if (slugTouched) return;

	clearTimeout(slugTimer);

	slugTimer = window.setTimeout(function () {
		ajax('/api/admin/polls/slug', {jwt: getJwt(), title: titleInput.value})
		.then(function (data) {
			if (slugTouched) return;

			slugInput.value = data.slug;
		})
		.catch(() => {});
	}, 400);
};

const {auth_token} = getAuthParams();

if (auth_token) {
	await retrieveJwt(auth_token);
}

if (await isAdmin()) {
	if (currentSlug) {
		await load(currentSlug).catch(showError);
	}
	else {
		addGroup({body: '', min: 1, max: null});
		relabel();
	}
}
else {
	const modal = showModal('login-form');

	modal.node.classList.toggle('error', hasAuth());
}

async function load(slug: string) {
	const data: PollStruct = await ajax('/api/admin/polls/get', {jwt: getJwt(), slug});

	byId('page-title').innerText = data.title || slug;

	titleInput.value = data.title;
	slugInput.value = data.slug || slug;
	introInput.value = data.intro;
	expireInput.value = data.expire || '';
	publicInput.checked = data.public;
	draftInput.checked = data.draft;

	groupsRoot.innerHTML = '';

	for (const group of data.groups) {
		addGroup(group);
	}

	relabel();

	const votes = data.votes || 0;

	byId('votes-warning').classList.toggle('d-none', votes === 0);
	byId('votes-count').innerText = String(votes);

	if (data.slugLocked) {
		slugInput.readOnly = true;
	}

	byId('prose-warning').classList.toggle('d-none', !data.proseRange);
}

function addGroup(group: GroupData) {
	const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;

	const body = qs<HTMLTextAreaElement>('[data-body]', node);
	const min = qs<HTMLInputElement>('[data-min]', node);
	const max = qs<HTMLInputElement>('[data-max]', node);
	const optional = qs<HTMLInputElement>('[data-optional]', node);

	body.value = group.body || '';
	min.value = String(group.min ?? 1);
	max.value = group.max === null || group.max === undefined ? '' : String(group.max);
	optional.checked = Number(group.min) === 0;

	applyType(node, group.type);
	applyOptional(node);

	optional.onchange = () => applyOptional(node);

	qs<HTMLButtonElement>('[data-remove]', node).onclick = function () {
		if (groupsRoot.children.length === 1) {
			error('Опитування має містити хоча б одну групу');
			return;
		}

		node.remove();
		relabel();
	};

	qs<HTMLButtonElement>('[data-up]', node).onclick = function () {
		const prev = node.previousElementSibling;

		if (prev) groupsRoot.insertBefore(node, prev);

		relabel();
	};

	qs<HTMLButtonElement>('[data-down]', node).onclick = function () {
		const next = node.nextElementSibling;

		if (next) groupsRoot.insertBefore(next, node);

		relabel();
	};

	groupsRoot.appendChild(node);
}

/**
 * «Необов'язкова» — це рівно min = 0, окремого поля в файлі немає.
 */
function applyOptional(node: HTMLElement) {
	const min = qs<HTMLInputElement>('[data-min]', node);
	const optional = qs<HTMLInputElement>('[data-optional]', node);

	if (optional.checked) {
		min.value = '0';
		min.disabled = true;
	}
	else {
		min.disabled = false;

		if (min.value === '0') {
			min.value = '1';
		}
	}
}

/**
 * Тип групи визначає сервер (при завантаженні і при прев'ю) — конструктор не
 * тримає власної копії знань про синтаксис.
 */
function applyType(node: HTMLElement, type?: string) {
	const hint = qs('[data-hint]', node);
	const maxCol = qs('[data-max-col]', node);

	if (type === 'radio') {
		// у radio-групі можна вибрати лише один варіант, тому «До» не має сенсу
		maxCol.classList.add('d-none');
		hint.innerText = 'Одна відповідь. «Від 0» дозволяє пропустити питання.';
		return;
	}

	maxCol.classList.remove('d-none');

	hint.innerText = (
		type === 'checkbox' ?
			'Кілька відповідей. Порожнє «До» — без обмеження.' :
			'Тип визначиться після прев\'ю.'
	);
}

function relabel() {
	Array.from(groupsRoot.children).forEach(function (node, i) {
		qs('[data-label]', node as HTMLElement).innerText = 'Група ' + (i + 1);
	});
}

function collect(): PollStruct {
	const groups: GroupData[] = Array.from(groupsRoot.children).map(function (node) {
		const el = node as HTMLElement;
		const max = qs<HTMLInputElement>('[data-max]', el).value.trim();

		return {
			body: qs<HTMLTextAreaElement>('[data-body]', el).value,
			min: Number(qs<HTMLInputElement>('[data-min]', el).value || 0),
			max: max === '' ? null : Number(max),
		};
	});

	return {
		title: titleInput.value,
		intro: introInput.value,
		groups,
		expire: expireInput.value || null,
		public: publicInput.checked,
		draft: draftInput.checked,
	};
}

async function renderPreview() {
	loading(previewBtn, true);

	try {
		const data = await ajax('/api/admin/preview', {jwt: getJwt(), ...collect()});

		byId('preview').innerHTML = data.html;
		byId('prose-warning').classList.toggle('d-none', !data.proseRange);

		Array.from(groupsRoot.children).forEach(function (node, i) {
			applyType(node as HTMLElement, data.groups[i]?.type);
		});
	}
	finally {
		loading(previewBtn, false);
	}
}

async function save(): Promise<string> {
	loading(saveBtn, true);

	try {
		const body = {
			jwt: getJwt(),
			slug: slugInput.value.trim(),
			prev_slug: currentSlug,
			...collect(),
		};

		const data = await ajax('/api/admin/polls/save', body);

		currentSlug = data.slug;
		slugTouched = true;

		const url = new URL(location.href);
		url.searchParams.set('slug', data.slug);
		history.replaceState({}, '', url);

		byId('page-title').innerText = titleInput.value || data.slug;

		return data.slug;
	}
	finally {
		loading(saveBtn, false);
	}
}

async function saveAndPublish() {
	const slug = await save();

	loading(savePublishBtn, true);
	log.classList.remove('d-none');
	log.innerText = 'запуск...';

	try {
		let job = await ajax('/api/admin/publish', {jwt: getJwt(), slug});

		while (job.status === 'running') {
			await wait(1000);

			job = await ajax('/api/admin/publish/status', {jwt: getJwt(), job_id: job.job_id});

			log.innerText = job.log.join('\n');
		}

		log.innerText = job.log.join('\n');

		if (job.status === 'failed') {
			error(job.error || 'Збірка не вдалася');
			return;
		}

		draftInput.checked = false;
		success('Опубліковано');
	}
	finally {
		loading(savePublishBtn, false);
	}
}

function wait(ms: number): Promise<void> {
	return new Promise(done => setTimeout(done, ms));
}

function showError(err: any) {
	if (err instanceof Response) return; // ajax уже показав повідомлення

	error(err?.message || 'Помилка запиту');
}
