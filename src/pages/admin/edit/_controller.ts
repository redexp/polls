import ajax from '@lib/ajax.js';
import {qs, byId, loading, copyText} from '@lib/dom.ts';
import {error, success} from '@lib/notify.ts';
import {getAuthParams, getJwt, hasAuth, isAdmin, retrieveJwt} from '@lib/auth.ts';
import {showModal, showHelpModal} from '@lib/modal.ts';

type AnswerType = 'checkbox'|'radio';

type GroupData = {
	body: string,
	min: number,
	max: number|null,
	type?: string,
	explicitRange?: boolean,
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
};

/** розбір питань, який повертає прев'ю; null — питання без варіантів */
type PreviewGroup = {type: string, values: string[]} | null;

const POLLS_PATH = '/polls/';

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

const editorRoot = document.querySelector<HTMLElement>('main.admin-edit')!;
const previewCol = byId('preview-col');
const previewBox = byId('preview');

/** порядок питань на момент останнього рендеру прев'ю, за їх gid */
let renderedGids: string[] = [];
/** розбір питань з останнього рендеру, у тому ж порядку */
let renderedGroups: PreviewGroup[] = [];

let gidSeq = 0;

// пояснення лежать у <template> у сторінці; делегування покриває і ті кнопки,
// що зʼявляються разом з новим питанням
document.addEventListener('click', function (e) {
	const btn = (e.target as HTMLElement).closest?.('[data-help]') as HTMLElement|null;

	if (!btn) return;

	const source = byId(btn.dataset.help!);

	if (source) showHelpModal(source);
});

byId('slug-prefix').innerText = location.origin + POLLS_PATH;

byId<HTMLButtonElement>('slug-copy').onclick = function () {
	copyPollUrl().catch(showError);
};

byId<HTMLButtonElement>('add-group').onclick = function () {
	const node = addGroup({body: '', min: 1, max: null});

	qs<HTMLTextAreaElement>('[data-body]', node).focus();
};

previewBtn.onclick = function () {
	if (isPreviewOpen()) {
		closePreview();
		return;
	}

	openPreview().catch(showError);
};

byId<HTMLButtonElement>('preview-refresh').onclick = function () {
	renderPreview().catch(showError);
};

byId<HTMLButtonElement>('preview-close').onclick = closePreview;

saveBtn.onclick = function () {
	save().then(() => success('Збережено')).catch(showError);
};

savePublishBtn.onclick = function () {
	saveAndPublish().catch(showError);
};

slugInput.oninput = function () {
	slugTouched = true;
};

// заголовок і вступ — початок сторінки, тому прев'ю гортаємо на самий верх
titleInput.addEventListener('focusin', () => scrollPreviewTo(null));
introInput.addEventListener('focusin', () => scrollPreviewTo(null));

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
	}
}
else {
	const modal = showModal('login-form');

	modal.node.classList.toggle('error', hasAuth());
}

async function load(slug: string) {
	const data: PollStruct = await ajax('/api/admin/polls/get', {jwt: getJwt(), slug});

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

	const votes = data.votes || 0;

	byId('votes-warning').classList.toggle('d-none', votes === 0);
	byId('votes-count').innerText = String(votes);

	if (data.slugLocked) {
		slugInput.readOnly = true;
	}
}

function pollUrl(): string {
	return location.origin + POLLS_PATH + slugInput.value.trim() + '/';
}

async function copyPollUrl() {
	const slug = slugInput.value.trim();

	if (!slug) {
		error('Спершу заповніть посилання');
		return;
	}

	if (await copyText(pollUrl())) {
		success(
			draftInput.checked ?
				'Посилання скопійовано. Опитування — чернетка, тому сторінка ще не опублікована.' :
				'Посилання скопійовано'
		);
	}
	else {
		error('Не вдалося скопіювати');
	}
}

function addGroup(group: GroupData): HTMLElement {
	const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;

	node.dataset.gid = String(++gidSeq);

	const body = qs<HTMLTextAreaElement>('[data-body]', node);
	const min = qs<HTMLInputElement>('[data-min]', node);
	const max = qs<HTMLInputElement>('[data-max]', node);
	const optional = qs<HTMLInputElement>('[data-optional]', node);
	const limit = qs<HTMLInputElement>('[data-limit]', node);

	body.value = group.body || '';
	min.value = String(group.min ?? 1);
	max.value = group.max === null || group.max === undefined ? '' : String(group.max);
	optional.checked = Number(group.min) === 0;
	// для одного варіанта {0-1} означає лише «можна пропустити», а не обмеження
	limit.checked = !!group.explicitRange && group.type !== 'radio';

	applyType(node, group.type);
	applyOptional(node);

	optional.onchange = () => applyOptional(node);
	limit.onchange = () => applyLimit(node);

	for (const btn of Array.from(node.querySelectorAll<HTMLButtonElement>('[data-type]'))) {
		btn.onclick = function () {
			const next = btn.dataset.type as AnswerType;

			if (node.dataset.type === next) return;

			retype(node, next).catch(showError);
		};
	}

	// фокус у будь-якому полі питання гортає прев'ю до цього ж питання
	node.addEventListener('focusin', () => scrollPreviewToGroup(node));

	qs<HTMLButtonElement>('[data-remove]', node).onclick = function () {
		if (groupsRoot.children.length === 1) {
			error('Опитування має містити хоча б одне питання');
			return;
		}

		node.remove();
	};

	qs<HTMLButtonElement>('[data-up]', node).onclick = function () {
		const prev = node.previousElementSibling;

		if (prev) groupsRoot.insertBefore(node, prev);
	};

	qs<HTMLButtonElement>('[data-down]', node).onclick = function () {
		const next = node.nextElementSibling;

		if (next) groupsRoot.insertBefore(next, node);
	};

	groupsRoot.appendChild(node);

	return node;
}

/**
 * Перемикає тип відповіді. Дужки в тексті переписує сервер — конструктор не
 * тримає власної копії знань про синтаксис.
 */
async function retype(node: HTMLElement, type: AnswerType) {
	const body = qs<HTMLTextAreaElement>('[data-body]', node);

	const data = await ajax('/api/admin/polls/retype', {
		jwt: getJwt(),
		body: body.value,
		type,
	});

	body.value = data.body;

	applyType(node, type);
}

/**
 * «Відповідь необов'язкова» — це рівно min = 0, окремого поля у файлі немає.
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
 * Поля «Від» і «До» показуються лише за галочкою «Обмежити кількість
 * відповідей» — без неї діють дефолти, і два порожніх поля були б шумом.
 */
function applyLimit(node: HTMLElement) {
	const single = node.dataset.type === 'radio';
	const on = qs<HTMLInputElement>('[data-limit]', node).checked && !single;

	qs('[data-min-col]', node).classList.toggle('d-none', !on);
	qs('[data-max-col]', node).classList.toggle('d-none', !on);
}

/**
 * Тип або задає перемикач, або приносить сервер при завантаженні і прев'ю.
 * Для «Тільки одна відповідь» обмежувати кількість нічим: вибрати можна лише
 * один варіант, а «можна пропустити» задається галочкою «необов'язкова».
 */
function applyType(node: HTMLElement, type?: string) {
	const resolved: AnswerType = type === 'radio' ? 'radio' : 'checkbox';

	node.dataset.type = resolved;

	for (const btn of Array.from(node.querySelectorAll<HTMLButtonElement>('[data-type]'))) {
		const active = btn.dataset.type === resolved;

		btn.classList.toggle('active', active);
		btn.setAttribute('aria-pressed', String(active));
	}

	qs('[data-limit-col]', node).classList.toggle('d-none', resolved === 'radio');

	applyLimit(node);
}

function collect(): PollStruct {
	const groups: GroupData[] = Array.from(groupsRoot.children).map(function (node) {
		const el = node as HTMLElement;
		const single = el.dataset.type === 'radio';
		const optional = qs<HTMLInputElement>('[data-optional]', el).checked;
		const limited = !single && qs<HTMLInputElement>('[data-limit]', el).checked;
		const minRaw = qs<HTMLInputElement>('[data-min]', el).value.trim();
		const maxRaw = qs<HTMLInputElement>('[data-max]', el).value.trim();

		return {
			body: qs<HTMLTextAreaElement>('[data-body]', el).value,
			min: optional ? 0 : (limited ? Number(minRaw || 1) : 1),
			// null — хай сервер підставить дефолт: для одного варіанта 1,
			// для кількох — усі варіанти питання
			max: limited && maxRaw !== '' ? Number(maxRaw) : null,
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

function isPreviewOpen(): boolean {
	return !previewCol.classList.contains('d-none');
}

async function openPreview() {
	previewCol.classList.remove('d-none');
	// розширюємо контейнер, а не звужуємо форму — форма лишається тієї ж ширини
	editorRoot.classList.add('with-preview');
	previewBtn.innerText = 'Сховати прев\'ю';

	await renderPreview();

	// якщо курсор уже стоїть у якомусь питанні — показати саме його
	const active = document.activeElement as HTMLElement|null;
	const group = active?.closest?.('.group') as HTMLElement|null;

	if (group) {
		scrollPreviewToGroup(group);
	}
}

function closePreview() {
	previewCol.classList.add('d-none');
	editorRoot.classList.remove('with-preview');
	previewBtn.innerText = 'Прев\'ю';
}

async function renderPreview() {
	loading(previewBtn, true);

	try {
		const data = await ajax('/api/admin/preview', {jwt: getJwt(), ...collect()});

		previewBox.innerHTML = data.html;

		renderedGroups = data.groups || [];
		renderedGids = Array.from(groupsRoot.children).map(node => (node as HTMLElement).dataset.gid!);

		// текст міг задати тип інакше, ніж стоїть перемикач — довіряємо розбору
		Array.from(groupsRoot.children).forEach(function (node, i) {
			const type = renderedGroups[i]?.type;

			if (type) applyType(node as HTMLElement, type);
		});
	}
	finally {
		loading(previewBtn, false);
	}
}

/**
 * Гортає прев'ю до питання, що зараз у фокусі.
 *
 * Прив'язка йде через значення першого варіанта, а не через порядковий номер:
 * `data-group` у розмітці нумерується розділювачами, тож питання без варіантів
 * збило б нумерацію. Якщо питання додали після рендеру — не гортаємо нікуди,
 * бо в прев'ю його ще немає.
 */
function scrollPreviewToGroup(node: HTMLElement) {
	if (!isPreviewOpen()) return;

	const index = renderedGids.indexOf(node.dataset.gid!);

	if (index < 0) return;

	const value = renderedGroups[index]?.values?.[0];

	if (!value) return;

	const input = previewBox.querySelector<HTMLInputElement>(`[value="${CSS.escape(value)}"]`);

	scrollPreviewTo(input?.closest('label') || input);
}

/**
 * Гортає мінімально: якщо цільове місце вже видно, не рухаємо нічого — інакше
 * прев'ю смикалось би при кожному переході фокусу між сусідніми питаннями.
 *
 * @param target null — на початок прев'ю
 */
function scrollPreviewTo(target: Element|null) {
	if (!isPreviewOpen()) return;

	if (!target) {
		previewBox.scrollTop = 0;
		return;
	}

	const gap = 12;
	const pane = previewBox.getBoundingClientRect();
	const el = target.getBoundingClientRect();

	const above = el.top - pane.top - gap;
	const below = el.bottom - pane.bottom + gap;

	if (above < 0) {
		previewBox.scrollTop += above;
	}
	else if (below > 0) {
		previewBox.scrollTop += below;
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
