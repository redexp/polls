import ajax, {uploadFile} from '@lib/ajax.js';
import {qs, byId, loading, copyText} from '@lib/dom.ts';
import {error, success} from '@lib/notify.ts';
import {getAuthParams, getJwt, hasAuth, isAdmin, retrieveJwt} from '@lib/auth.ts';
import {showModal, showHelpModal} from '@lib/modal.ts';
// лише типи: сам модуль редактора вантажиться динамічно, коли перемикач увімкнено
import type {PollEditor, ImageItem} from './_editor.ts';

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
	/** текст після всіх питань; порожній — блоку результатів немає */
	outro: string,
	hideQuestions: boolean,
	/** картинки, на які посилається текст: id → адреса */
	images: Record<string, string>,
	expire: string|null,
	public: boolean,
	draft: boolean,
	votes?: number,
	slugLocked?: boolean,
};

/** розбір питань, який повертає прев'ю; null — питання без варіантів */
type PreviewGroup = {type: string, values: string[]} | null;

/**
 * Картинка, відома конструктору. Збережена має лише адресу на сервері;
 * незбережена — ще й сам файл, а адреса в неї blob: з цієї ж вкладки.
 */
type ImageEntry = {
	url: string,
	file?: File,
};

const POLLS_PATH = '/polls/';

const IMAGE_UPLOAD_URL = '/api/admin/polls/image';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
/** підпис картинки в тексті; номер — наступний за найбільшим в опитуванні */
const IMAGE_LABEL = 'Картинка';
/** посилальна картинка в тексті: ![Картинка 1][id] */
const IMAGE_REF_RE = /!\[([^\]]*)\]\[([^\]\s]+)\]/g;
/** власне визначення картинки в тексті: [id]: адреса */
const IMAGE_DEF_RE = /^\s*\[([^\]\s]+)\]:/;

const params = new URLSearchParams(location.search);

/** id опитування, яке редагуємо; null — створення нового */
let currentSlug: string|null = params.get('slug');

/** чи користувач правив поле id руками — тоді автогенерація не втручається */
let slugTouched = !!currentSlug;

/**
 * Стан публікації. Окремого поля у формі немає: його задають кнопки
 * «Опублікувати» / «Зробити чернеткою», а «Зберегти» лишає як є. Нове
 * опитування починається чернеткою, щоб не потрапити на сайт випадково.
 */
let isDraft = true;

const groupsRoot = byId('groups');
const tpl = byId<HTMLTemplateElement>('group-tpl');

const titleInput = byId<HTMLInputElement>('title');
const slugInput = byId<HTMLInputElement>('slug');
const introInput = byId<HTMLTextAreaElement>('intro');
const outroInput = byId<HTMLTextAreaElement>('outro');
const resultsInput = byId<HTMLInputElement>('results');
const hideQuestionsInput = byId<HTMLInputElement>('hide-questions');
const hideQuestionsCol = byId('hide-questions-col');
const expireInput = byId<HTMLInputElement>('expire');
const anonymousInput = byId<HTMLInputElement>('anonymous');

const saveBtn = byId<HTMLButtonElement>('save');
const publishToggleBtn = byId<HTMLButtonElement>('publish-toggle');
const previewBtn = byId<HTMLButtonElement>('preview-btn');
const log = byId<HTMLPreElement>('log');

const previewCol = byId('preview-col');
const previewBox = byId('preview');

/** порядок питань на момент останнього рендеру прев'ю, за їх gid */
let renderedGids: string[] = [];
/** розбір питань з останнього рендеру, у тому ж порядку */
let renderedGroups: PreviewGroup[] = [];

let gidSeq = 0;

/**
 * Усі картинки, які бачив конструктор, за id. Запис не видаляється, коли токен
 * прибирають з тексту: на сервер усе одно йдуть лише ті, на які текст
 * посилається, а повернутий токен знову знайде свій файл.
 */
const images = new Map<string, ImageEntry>();

/**
 * Поля, що хоч раз були у фокусі. У такого поля позиція курсора осмислена,
 * і картинка стає туди; в інше поле — у кінець тексту.
 */
const touchedAreas = new WeakSet<HTMLTextAreaElement>();

const introImageBtn = byId<HTMLButtonElement>('intro-image');
const introImageFile = byId<HTMLInputElement>('intro-image-file');

/** перемикач візуального редактора; стан — вподобання людини, не опитування */
const visualInput = byId<HTMLInputElement>('visual-editor');
const VISUAL_KEY = 'admin-visual-editor';

/** змонтовані редактори за textarea, яку вони замінюють */
const editors = new Map<HTMLTextAreaElement, PollEditor>();

/** модуль редактора вантажиться один раз і лише за потреби */
let editorModule: Promise<typeof import('./_editor.ts')>|null = null;

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

	focusArea(qs<HTMLTextAreaElement>('[data-body]', node));
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

publishToggleBtn.onclick = function () {
	setPublished(isDraft).catch(showError);
};

applyPublishState();

slugInput.oninput = function () {
	slugTouched = true;
};

// заголовок і вступ — початок сторінки, тому прев'ю гортаємо на самий верх
titleInput.addEventListener('focusin', () => scrollPreviewTo(null));
introInput.addEventListener('focusin', () => scrollPreviewTo(null));

// текст результатів — навпаки, хвіст сторінки
outroInput.addEventListener('focusin', () => scrollPreviewToEnd());

attachImageDrop(introInput);
attachImageDrop(outroInput);

introImageBtn.onclick = function () {
	introImageFile.click();
};

introImageFile.onchange = function () {
	const files = introImageFile.files;
	const editor = editors.get(introInput);

	if (files?.length && editor) {
		// у візуальному режимі textarea схована — картинка стає в редактор
		editor.insertImages(registerImageFiles(files));
	}
	else if (files?.length) {
		addImageFiles(introInput, files);
	}

	// інакше той самий файл удруге не вибрати — change не спрацює
	introImageFile.value = '';
};

resultsInput.onchange = applyResults;
applyResults();

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
	await retrieveJwt(auth_token, true);
}

if (await isAdmin()) {
	if (currentSlug) {
		await load(currentSlug).catch(showError);
	}
	else {
		addGroup({body: '', min: 1, max: null});
	}

	// після завантаження тексту, щоб редактори одразу отримали вміст
	visualInput.checked = readVisualPref();

	visualInput.onchange = function () {
		setVisual(visualInput.checked).catch(showError);
	};

	if (visualInput.checked) {
		await setVisual(true).catch(showError);
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
	expireInput.value = data.expire || '';
	anonymousInput.checked = !data.public;

	// картинки — до текстів: мініатюри рендеряться разом із заповненням полів
	images.clear();

	for (const [id, url] of Object.entries(data.images || {})) {
		images.set(id, {url});
	}

	introInput.value = data.intro;
	renderStrip(introInput);

	outroInput.value = data.outro || '';
	renderStrip(outroInput);
	hideQuestionsInput.checked = !!data.hideQuestions;
	// окремого поля у файлі немає: блок увімкнений, якщо в ньому щось задано
	resultsInput.checked = !!(data.outro || data.hideQuestions);
	applyResults();

	isDraft = data.draft;
	applyPublishState();

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
			isDraft ?
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
	attachImageDrop(body);
	renderStrip(body);

	if (visualInput.checked) {
		mountEditor(body).catch(showError);
	}

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

		editors.get(body)?.destroy();
		editors.delete(body);

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
	syncEditor(body);

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

	// is-hidden лишає колонки в потоці — інакше рядок стрибав би по висоті
	qs('[data-min-col]', node).classList.toggle('is-hidden', !on);
	qs('[data-max-col]', node).classList.toggle('is-hidden', !on);
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

	// вимкнений перемикач не стирає текст у полі — його видно знову, щойно
	// блок повернуть; у файл при цьому не потрапляє нічого
	const results = resultsInput.checked;

	const intro = introInput.value;
	const outro = results ? outroInput.value : '';

	return {
		title: titleInput.value,
		intro,
		groups,
		outro,
		hideQuestions: results && hideQuestionsInput.checked,
		// лише ті картинки, на які посилається текст, що йде на сервер: у
		// незбережених адреса blob:, і прев'ю покаже їх з неї, а збереження
		// спершу замінить її на серверну
		images: referencedImages([intro, ...groups.map(group => group.body), outro]),
		// type=date завжди віддає РРРР-ММ-ДД, незалежно від формату показу
		expire: expireInput.value || null,
		public: !anonymousInput.checked,
		draft: isDraft,
	};
}

/**
 * Блок результатів: текст під усіма питаннями і, разом з ним, можливість
 * згорнути самі питання. Перемикач лише відкриває поля — у файл іде те, що в
 * них, тому вимкнення нічого не стирає.
 */
function applyResults() {
	const on = resultsInput.checked;

	// textarea лишається схованою, поки замість неї стоїть редактор
	outroInput.classList.toggle('d-none', !on || editors.has(outroInput));
	editors.get(outroInput)?.element.classList.toggle('d-none', !on);
	stripOf(outroInput).classList.toggle('d-none', !on);
	hideQuestionsCol.classList.toggle('d-none', !on);
}

// ---------------------------------------------------------------------------
// Картинки
//
// До збереження файл живе у вкладці, у тексті стоїть токен ![Картинка N][id], а
// під полем — мініатюра. Смужка мініатюр — похідна від токенів у тексті поля,
// тому в неї одне джерело правди: прибрали токен — зникла мініатюра, натиснули
// хрестик — зник токен.
// ---------------------------------------------------------------------------

/**
 * Перетягування і вставка з буфера працюють на всіх полях; кнопка з файловим
 * інпутом є лише у вступу.
 */
function attachImageDrop(area: HTMLTextAreaElement) {
	stripOf(area);

	area.addEventListener('focusin', () => touchedAreas.add(area));
	area.addEventListener('input', () => renderStrip(area));

	area.addEventListener('dragover', function (e) {
		if (!hasFiles(e)) return;

		e.preventDefault();
		area.classList.add('is-drop-target');
	});

	area.addEventListener('dragleave', () => area.classList.remove('is-drop-target'));

	area.addEventListener('drop', function (e) {
		area.classList.remove('is-drop-target');

		const files = e.dataTransfer?.files;

		if (!files?.length) return;

		e.preventDefault();
		addImageFiles(area, files);
	});

	area.addEventListener('paste', function (e) {
		const files = Array.from(e.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));

		if (files.length === 0) return;

		e.preventDefault();
		addImageFiles(area, files);
	});
}

function hasFiles(e: DragEvent): boolean {
	return Array.from(e.dataTransfer?.types || []).includes('Files');
}

/**
 * Кожен файл стає записом у `images` і отримує підпис з наступним номером. Тип
 * перевіряється і тут, щоб не тримати у вкладці те, що сервер потім відхилить.
 * Спільне для обох режимів: у сирому токени вставляє addImageFiles, у
 * візуальному — сам редактор.
 */
function registerImageFiles(files: FileList|File[]): ImageItem[] {
	const list = Array.from(files);
	const accepted = list.filter(file => IMAGE_TYPES.includes(file.type));

	if (accepted.length < list.length) {
		error('Підтримуються лише картинки png, jpg і webp');
	}

	// номери для всієї пачки одразу: текст оновиться лише після вставки
	let number = nextImageNumber();

	return accepted.map(function (file) {
		const id = newImageId();

		images.set(id, {url: URL.createObjectURL(file), file});

		return {alt: `${IMAGE_LABEL} ${number++}`, id};
	});
}

/** сирий режим: кожна картинка — окремий токен у textarea */
function addImageFiles(area: HTMLTextAreaElement, files: FileList|File[]) {
	const items = registerImageFiles(files);

	for (const item of items) {
		insertBlock(area, `![${item.alt}][${item.id}]`);
	}

	if (items.length > 0) {
		renderStrip(area);
	}
}

function newImageId(): string {
	let id;

	do {
		id = Math.random().toString(36).slice(2, 10);
	}
	while (images.has(id) || id.length < 8);

	return id;
}

/**
 * Найбільший номер «Картинка N» у всьому опитуванні плюс один, щоб у вступі і в
 * питанні не було двох перших. Після видалень номери не перераховуються.
 */
function nextImageNumber(): number {
	const re = new RegExp('!\\[' + IMAGE_LABEL + ' (\\d+)\\]\\[', 'g');

	let max = 0;

	for (const area of managedAreas()) {
		for (const match of area.value.matchAll(re)) {
			max = Math.max(max, Number(match[1]));
		}
	}

	return max + 1;
}

/** усі текстові поля, у яких можуть бути картинки */
function managedAreas(): HTMLTextAreaElement[] {
	return [
		introInput,
		outroInput,
		...Array.from(groupsRoot.querySelectorAll<HTMLTextAreaElement>('[data-body]')),
	];
}

/**
 * Вставляє текст окремим абзацем: у позицію курсора, якщо поле хоч раз було у
 * фокусі, інакше в кінець. Порожні рядки навколо додаються лише ті, яких бракує.
 */
function insertBlock(area: HTMLTextAreaElement, text: string) {
	const value = area.value;
	const atCaret = touchedAreas.has(area);
	const from = atCaret ? area.selectionStart : value.length;
	const to = atCaret ? area.selectionEnd : value.length;

	const before = value.slice(0, from);
	const after = value.slice(to);

	const prefix = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
	const suffix = after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';

	const inserted = prefix + text + suffix;

	area.value = before + inserted + after;

	const caret = before.length + inserted.length;

	area.setSelectionRange(caret, caret);
	area.dispatchEvent(new Event('input', {bubbles: true}));
}

/** прибирає з поля всі токени картинки і зайві порожні рядки після них */
function removeImageToken(area: HTMLTextAreaElement, id: string) {
	const re = new RegExp('!\\[[^\\]]*\\]\\[' + escapeRegExp(id) + '\\][ \\t]*', 'g');

	area.value = (
		area.value
		.replace(re, '')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/^\n+/, '')
		.replace(/\n+$/, '')
	);

	area.dispatchEvent(new Event('input', {bubbles: true}));
	syncEditor(area);
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** смужка мініатюр одразу під полем; створюється при першому звертанні */
function stripOf(area: HTMLTextAreaElement): HTMLElement {
	const next = area.nextElementSibling as HTMLElement|null;

	if (next?.classList.contains('image-strip')) return next;

	const strip = document.createElement('div');

	strip.className = 'image-strip';
	area.after(strip);

	return strip;
}

function renderStrip(area: HTMLTextAreaElement) {
	const strip = stripOf(area);
	const text = area.value;
	const defined = definedIds(text);
	const shown = new Set<string>();

	strip.replaceChildren();

	for (const match of text.matchAll(IMAGE_REF_RE)) {
		const [, alt, id] = match;

		// у токена є власне визначення в тексті — це не картинка конструктора
		if (defined.includes(id) || shown.has(id)) continue;

		shown.add(id);
		strip.appendChild(createThumb(area, id, alt));
	}
}

function createThumb(area: HTMLTextAreaElement, id: string, alt: string): HTMLElement {
	const entry = images.get(id);

	const node = document.createElement('div');
	node.className = 'image-thumb';
	node.dataset.id = id;
	node.classList.toggle('is-missing', !entry);

	const img = document.createElement('img');
	img.alt = alt;

	if (entry) {
		img.src = entry.url;
	}

	const caption = document.createElement('span');
	caption.className = 'caption';
	// файлу немає — токен лишився з попереднього сеансу, а картинка ні
	caption.innerText = entry ? alt : 'файл відсутній';
	caption.title = caption.innerText;

	const remove = document.createElement('button');
	remove.type = 'button';
	remove.className = 'btn-remove';
	remove.title = 'Видалити картинку';
	remove.setAttribute('aria-label', 'Видалити картинку ' + alt);
	remove.innerText = '×';
	remove.onclick = () => removeImageToken(area, id);

	node.append(img, caption, remove);

	return node;
}

/** ідентифікатори посилальних картинок у тексті, без повторів */
function referencedIds(text: string): string[] {
	const ids: string[] = [];

	for (const match of text.matchAll(IMAGE_REF_RE)) {
		if (!ids.includes(match[2])) ids.push(match[2]);
	}

	return ids;
}

/** ідентифікатори з власним визначенням `[id]: …` у тексті */
function definedIds(text: string): string[] {
	const ids: string[] = [];

	for (const line of text.split('\n')) {
		const match = line.match(IMAGE_DEF_RE);

		if (match) ids.push(match[1]);
	}

	return ids;
}

/** мапа id → адреса для картинок, на які посилаються ці тексти */
function referencedImages(texts: string[]): Record<string, string> {
	const result: Record<string, string> = {};

	for (const id of referencedIds(texts.join('\n'))) {
		const entry = images.get(id);

		if (entry) result[id] = entry.url;
	}

	return result;
}

/**
 * Перша фаза збереження: незбережені файли їдуть на сервер, і мапа отримує
 * серверні адреси замість blob:. Самі записи не змінюються, поки опитування не
 * збережено — інакше невдале збереження лишило б мініатюри без картинок.
 */
async function uploadPending(refs: Record<string, string>): Promise<Record<string, string>> {
	const result: Record<string, string> = {};

	for (const [id, url] of Object.entries(refs)) {
		const entry = images.get(id);

		if (!entry?.file) {
			result[id] = url;
			continue;
		}

		const data = await uploadFile(IMAGE_UPLOAD_URL, entry.file, getJwt());

		result[id] = data.url;
	}

	return result;
}

/**
 * Після успішного збереження картинки стають серверними: blob: більше не
 * потрібен, як і сам файл у пам'яті.
 */
function commitUploaded(uploaded: Record<string, string>) {
	for (const [id, url] of Object.entries(uploaded)) {
		const entry = images.get(id);

		if (!entry || entry.url === url) continue;

		if (entry.file) {
			URL.revokeObjectURL(entry.url);
		}

		images.set(id, {url});
	}

	for (const area of managedAreas()) {
		renderStrip(area);
	}
}

function isPreviewOpen(): boolean {
	return !previewCol.classList.contains('d-none');
}

async function openPreview() {
	// місце під прев'ю зарезервоване в стилях, тому форма і кнопки не рухаються
	previewCol.classList.remove('d-none');
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
 * Гортає прев'ю до питання, що зараз у фокусі, показуючи його варіанти цілком.
 *
 * Прив'язка йде через значення варіантів, а не через порядковий номер:
 * `data-group` у розмітці нумерується розділювачами, тож питання без варіантів
 * збило б нумерацію. Якщо питання додали після рендеру — не гортаємо нікуди,
 * бо в прев'ю його ще немає.
 */
function scrollPreviewToGroup(node: HTMLElement) {
	if (!isPreviewOpen()) return;

	const index = renderedGids.indexOf(node.dataset.gid!);

	if (index < 0) return;

	const values = renderedGroups[index]?.values;

	if (!values?.length) return;

	const first = findPreviewInput(values[0]);

	if (!first) return;

	// останній варіант шукаємо вже в межах того самого блоку розмітки: однакові
	// підписи в різних питаннях інакше вкрали б нижню межу діапазону
	const last = findPreviewInput(values[values.length - 1], first.dataset.group) || first;

	scrollPreviewTo(lineStart(first), lineEnd(last));
}

/**
 * @param value
 * @param [group] якщо задано — шукати лише серед варіантів цього блоку розмітки
 */
function findPreviewInput(value: string, group?: string): HTMLInputElement|null {
	const scope = group === undefined ? '' : `[data-group="${CSS.escape(group)}"]`;

	return previewBox.querySelector<HTMLInputElement>(`input${scope}[value="${CSS.escape(value)}"]`);
}

/** верхня межа варіанта — його підпис разом з кружечком */
function lineStart(input: HTMLInputElement): Element {
	return input.closest('label') || input;
}

/** нижня межа варіанта — поле «своя відповідь», якщо воно в нього є */
function lineEnd(input: HTMLInputElement): Element {
	const label = lineStart(input);
	const next = label.nextElementSibling;

	return next?.tagName === 'TEXTAREA' ? next : label;
}

/**
 * Гортає плавно і мінімально: якщо питання вже видно цілком, не рухаємо
 * нічого — інакше прев'ю смикалось би при кожному переході фокусу між
 * сусідніми питаннями. Питання, вище за саме прев'ю, притискаємо горішнім
 * краєм: краще показати його початок, ніж хвіст.
 *
 * @param start null — на початок прев'ю
 * @param end кінець діапазону, який має вміститися; за замовчуванням — start
 */
function scrollPreviewTo(start: Element|null, end: Element|null = start) {
	if (!isPreviewOpen()) return;

	if (!start || !end) {
		scrollPreview(0);
		return;
	}

	const gap = 12;
	const pane = previewBox.getBoundingClientRect();

	/** від'ємне — початок питання вище за видиму частину */
	const above = start.getBoundingClientRect().top - pane.top - gap;
	/** додатне — кінець питання нижче за видиму частину */
	const below = end.getBoundingClientRect().bottom - pane.bottom + gap;

	let delta;

	if (above < 0) {
		delta = above;
	}
	else if (below > 0) {
		// питання не вміщується цілком — радше обріжемо хвіст, ніж початок
		delta = Math.min(below, above);
	}
	else return;

	scrollPreview(previewBox.scrollTop + delta);
}

/** до самого низу прев'ю — там, де текст результатів */
function scrollPreviewToEnd() {
	if (!isPreviewOpen()) return;

	scrollPreview(previewBox.scrollHeight);
}

function scrollPreview(top: number) {
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

	previewBox.scrollTo({top, behavior: reduced ? 'auto' : 'smooth'});
}

// ---------------------------------------------------------------------------
// Візуальний редактор
//
// Замінює textarea на всіх полях одразу і пише markdown назад у неї при кожній
// зміні, тому collect(), збереження і прев'ю про нього не знають. Зміни, що
// приходять із textarea (retype, хрестик на мініатюрі), треба явно віддати
// редактору через syncEditor.
// ---------------------------------------------------------------------------

function readVisualPref(): boolean {
	try {
		return localStorage.getItem(VISUAL_KEY) === '1';
	}
	catch {
		return false;
	}
}

function saveVisualPref(on: boolean) {
	try {
		localStorage.setItem(VISUAL_KEY, on ? '1' : '0');
	}
	catch {
		// приватний режим чи заборонене сховище — вподобання просто не запам'ятається
	}
}

async function setVisual(on: boolean) {
	saveVisualPref(on);

	if (on) {
		await Promise.all(managedAreas().map(mountEditor));
		return;
	}

	for (const area of managedAreas()) {
		unmountEditor(area);
	}
}

function loadEditorModule() {
	if (!editorModule) {
		editorModule = import('./_editor.ts');
	}

	return editorModule;
}

async function mountEditor(area: HTMLTextAreaElement) {
	if (editors.has(area)) return;

	const mod = await loadEditorModule();

	// поки модуль вантажився, перемикач могли вимкнути або поле — видалити
	if (editors.has(area) || !visualInput.checked || !area.isConnected) return;

	const editor = mod.createEditor({
		area,
		onUpdate(markdown) {
			area.value = markdown;
			renderStrip(area);
		},
		onImageFiles: registerImageFiles,
		// кнопка «Картинка» є лише у вступу — та сама, що й у сирому режимі
		onImageButton: area === introInput ? () => introImageFile.click() : undefined,
	});

	editors.set(area, editor);
	area.classList.add('d-none');

	if (area === introInput) {
		editor.element.addEventListener('focusin', () => scrollPreviewTo(null));
	}

	if (area === outroInput) {
		editor.element.classList.toggle('d-none', !resultsInput.checked);
		editor.element.addEventListener('focusin', () => scrollPreviewToEnd());
	}
}

function unmountEditor(area: HTMLTextAreaElement) {
	const editor = editors.get(area);

	if (!editor) return;

	area.value = editor.getMarkdown();

	editor.destroy();
	editors.delete(area);

	// текст результатів лишається схованим, якщо його блок вимкнено
	area.classList.toggle('d-none', area === outroInput && !resultsInput.checked);

	renderStrip(area);
}

/** textarea змінили ззовні — редактор має показати те саме */
function syncEditor(area: HTMLTextAreaElement) {
	editors.get(area)?.setMarkdown(area.value);
}

function focusArea(area: HTMLTextAreaElement) {
	const editor = editors.get(area);

	if (editor) {
		editor.focus();
	}
	else {
		area.focus();
	}
}

async function save(): Promise<string> {
	loading(saveBtn, true);

	try {
		const struct = collect();

		// дві фази: спершу файли в тимчасову теку сервера, потім сам файл
		// опитування з їхніми адресами — сервер перенесе їх у постійну теку
		const uploaded = await uploadPending(struct.images);

		const body = {
			jwt: getJwt(),
			slug: slugInput.value.trim(),
			prev_slug: currentSlug,
			...struct,
			images: uploaded,
		};

		const data = await ajax('/api/admin/polls/save', body);

		commitUploaded(uploaded);

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

function applyPublishState() {
	publishToggleBtn.innerText = isDraft ? 'Опублікувати' : 'Зробити чернеткою';

	publishToggleBtn.classList.toggle('btn-success', isDraft);
	publishToggleBtn.classList.toggle('btn-warning', !isDraft);
}

/**
 * Обидва напрямки вимагають збірки: опублікувати — щоб сторінка зʼявилась,
 * зробити чернеткою — щоб уже опублікована зникла.
 */
async function setPublished(published: boolean) {
	const previous = isDraft;

	isDraft = !published;

	log.classList.remove('d-none');
	log.innerText = 'запуск...';

	loading(publishToggleBtn, true);

	try {
		const slug = await save();

		// slug передаємо лише при публікації: там сервер ще й сам зніме чернетку
		let job = await ajax('/api/admin/publish', published ? {jwt: getJwt(), slug} : {jwt: getJwt()});

		while (job.status === 'running') {
			await wait(1000);

			job = await ajax('/api/admin/publish/status', {jwt: getJwt(), job_id: job.job_id});

			log.innerText = job.log.join('\n');
		}

		log.innerText = job.log.join('\n');

		if (job.status === 'failed') {
			throw {message: job.error || 'Збірка не вдалася'};
		}

		success(published ? 'Опубліковано' : 'Опитування знову чернетка');
	}
	catch (err) {
		// стан не змінився, тому кнопка має лишитись такою ж, як була
		isDraft = previous;

		throw err;
	}
	finally {
		applyPublishState();
		loading(publishToggleBtn, false);
	}
}

function wait(ms: number): Promise<void> {
	return new Promise(done => setTimeout(done, ms));
}

function showError(err: any) {
	if (err instanceof Response) return; // ajax уже показав повідомлення

	error(err?.message || 'Помилка запиту');
}
