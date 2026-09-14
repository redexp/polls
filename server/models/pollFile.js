import {readdir, readFile, writeFile, unlink} from 'node:fs/promises';
import {resolve, relative, basename, sep} from 'node:path';
import {parse} from 'yaml';
import {POLLS_DIR, IMAGES_URL} from '../config/index.js';

export const SLUG_RE = /^[a-z0-9-]+$/;

/** рядок-розділювач груп: три і більше дефіси */
const HR_RE = /^\s*-{3,}\s*$/;
/** директива обмежень групи: {min-max}, завжди два числа */
const DIRECTIVE_RE = /^\s*\{(\d+)\s*-\s*(\d+)\}\s*$/;
/** [значення] Підпис — checkbox; `+` вимагає поле вільного тексту, `:` це image ref */
const CHECKBOX_RE = /^\s*\[([^\]]+)\]([+:]?)/;
/** (значення) Підпис — radio */
const RADIO_RE = /^\s*\(([^)]+)\)(\+?)/;
/** \[...\] — екранований markdown, повертаємо у звичайний вигляд */
const ESCAPED_RE = /^\s*\\\[([^\]]+)\\\]/gm;

const FRONTMATTER_RE = /^---+\s*\r?\n(.*?)\r?\n---+\s*\r?\n/s;

/** визначення посилальної картинки: `[id]: адреса` */
const IMAGE_DEF_RE = /^\s*\[([^\]\s]+)\]:\s*(\S+)\s*$/;
/** посилальна картинка в тексті: `![Картинка 1][id]` */
const IMAGE_REF_RE = /!\[[^\]]*\]\[([^\]\s]+)\]/g;

const GROUP_SEPARATOR = '\n\n-------------------\n\n';

/** підпис, за яким розгортаються сховані питання */
const SUMMARY_TEXT = 'Показати питання';

const DETAILS_OPEN_RE = /^\s*<details\b[^>]*>\s*$/i;
const DETAILS_CLOSE_RE = /^\s*<\/details>\s*$/i;
const SUMMARY_RE = /^\s*<summary\b[^>]*>.*<\/summary>\s*$/i;

/**
 * Валідує slug і повертає абсолютний шлях до файлу опитування.
 * Єдине місце, де зі slug робиться шлях — саме тут відсікається path traversal.
 *
 * @param {string} slug
 * @returns {string}
 */
export function pollPath(slug) {
	validateSlug(slug);

	const path = resolve(POLLS_DIR, slug + '.md');

	if (path !== resolve(POLLS_DIR, basename(path))) {
		throw {type: 'invalid_slug', slug};
	}

	return path;
}

/**
 * @param {string} slug
 */
export function validateSlug(slug) {
	if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
		throw {type: 'invalid_slug', slug};
	}
}

/**
 * Рекурсивний список .md файлів відносно POLLS_DIR.
 * Рекурсивний навіть попри те, що адмінка не показує підтеки: id опитування —
 * це лише basename, тому він унікальний глобально.
 *
 * @returns {Promise<string[]>}
 */
export async function listPollFiles() {
	const list = await readdir(POLLS_DIR, {recursive: true});

	return list.filter(path => path.endsWith('.md'));
}

/**
 * Шукає інший файл із таким самим id. Повертає його шлях або null.
 *
 * @param {string} slug
 * @returns {Promise<string|null>}
 */
export async function findSlugConflict(slug) {
	const list = await listPollFiles();

	for (const path of list) {
		if (basename(path, '.md') !== slug) continue;

		if (path === slug + '.md') continue; // сам файл

		return path.split(sep).join('/');
	}

	return null;
}

/**
 * @param {string} md
 * @returns {{data: Object, body: string}}
 */
export function stripFrontmatter(md) {
	let data = {};

	const body = md.replace(FRONTMATTER_RE, function (_, yaml) {
		data = parse(yaml) || {};

		return '';
	});

	return {data, body};
}

/**
 * Знімає обгортку <details>, під яку ховаються питання: далі тіло розбирається
 * так само, як і без неї, тож решта коду про обгортку не знає.
 *
 * @param {string} body
 * @returns {{body: string, hidden: boolean}}
 */
export function stripDetails(body) {
	let hidden = false;

	const lines = body.split(/\r?\n/).filter(function (line) {
		if (DETAILS_OPEN_RE.test(line)) {
			hidden = true;

			return false;
		}

		return !DETAILS_CLOSE_RE.test(line) && !SUMMARY_RE.test(line);
	});

	return {body: lines.join('\n'), hidden};
}

/**
 * Ділить тіло на сегменти по рядках-розділювачах.
 *
 * Розділювачем вважається рядок дефісів, перед яким порожній рядок (або початок
 * тіла) — саме так markdown відрізняє <hr> від setext-заголовка. Без цієї умови
 * серверний парсер бачив би групу там, де рендер бачить заголовок.
 *
 * @param {string} body
 * @returns {string[][]} масив сегментів, сегмент — масив рядків
 */
export function splitSegments(body) {
	const lines = body.split(/\r?\n/);
	const segments = [];

	let current = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const isSeparator = (
			HR_RE.test(line) &&
			(i === 0 || lines[i - 1].trim() === '')
		);

		if (isSeparator) {
			segments.push(current);
			current = [];
			continue;
		}

		current.push(line);
	}

	segments.push(current);

	return segments;
}

/**
 * @param {string} line
 * @returns {{value: string, type: 'checkbox'|'radio', text: boolean}|null}
 */
export function matchAnswer(line) {
	const trimmed = line.trim();

	if (trimmed.startsWith('[')) {
		const match = trimmed.match(CHECKBOX_RE);

		if (!match) return null;

		if (match[2] === ':') return null; // image ref: [image]: <data...

		return {
			value: match[1].trim(),
			type: 'checkbox',
			text: match[2] === '+',
		};
	}

	if (trimmed.startsWith('(')) {
		const match = trimmed.match(RADIO_RE);

		if (!match) return null;

		return {
			value: match[1].trim(),
			type: 'radio',
			text: match[2] === '+',
		};
	}

	return null;
}

/**
 * Чи рядок узагалі претендує на роль відповіді (щоб відрізнити помилку синтаксису
 * від звичайної прози).
 *
 * @param {string} line
 * @returns {boolean}
 */
function looksLikeAnswer(line) {
	const trimmed = line.trim();

	return trimmed.startsWith('[') || trimmed.startsWith('(');
}

/**
 * Посилальний image ref (`[img]: <...>`) — валідний markdown, який легко
 * написати руками, тому він не має ставати invalid_closing_bracket.
 *
 * @param {string} line
 * @returns {boolean}
 */
export function isImageRef(line) {
	return /^\s*\[[^\]]+\]:/.test(line);
}

/**
 * Вирізає з тіла визначення картинок, якими керує адмінка — ті, що вказують на
 * IMAGES_URL. Вирізати треба з усього тіла, а не з хвоста: без тексту
 * результатів визначення опинилися б у тілі останнього питання, з ним — у
 * тексті результатів. Визначення з іншими адресами (написані руками, зокрема
 * `[image]: <data:...>` зі старого імпорту) лишаються в тексті як були.
 *
 * @param {string} body
 * @returns {{body: string, images: Object<string, string>}} images — id → адреса
 */
export function extractImageDefs(body) {
	const images = {};

	const lines = body.split(/\r?\n/).filter(function (line) {
		const match = line.match(IMAGE_DEF_RE);

		if (!match || !match[2].startsWith(IMAGES_URL)) return true;

		images[match[1]] = match[2];

		return false;
	});

	return {body: lines.join('\n'), images};
}

/**
 * Ідентифікатори посилальних картинок `![…][id]` у тексті, без повторів, у
 * порядку появи.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findImageRefs(text) {
	const ids = [];

	for (const match of String(text || '').matchAll(IMAGE_REF_RE)) {
		if (!ids.includes(match[1])) ids.push(match[1]);
	}

	return ids;
}

/**
 * Ідентифікатори, для яких у тексті є власне визначення `[id]: …` — байдуже,
 * куди воно вказує. Такі посилання не потребують картинки від адмінки.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findDefinedIds(text) {
	const ids = [];

	for (const line of String(text || '').split(/\r?\n/)) {
		const match = line.match(IMAGE_DEF_RE);

		if (match) ids.push(match[1]);
	}

	return ids;
}

/**
 * Ім'я файлу з адреси картинки адмінки; null — адреса не з IMAGES_URL.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function imageNameFromUrl(url) {
	if (typeof url !== 'string' || !url.startsWith(IMAGES_URL)) return null;

	return url.slice(IMAGES_URL.length);
}

/**
 * Імена файлів картинок, на які посилається файл опитування. Різниця цих
 * списків до і після збереження — це те, що треба перенести або видалити.
 *
 * @param {string} md
 * @returns {string[]}
 */
export function imageFilesOf(md) {
	const {body} = stripFrontmatter(md);
	const {images} = extractImageDefs(body);

	return Object.values(images).map(imageNameFromUrl).filter(name => !!name);
}

/**
 * Переписує дужки варіантів під інший тип відповіді, зберігаючи значення і `+`.
 *
 * Живе тут, а не в конструкторі, щоб знання про синтаксис не роздвоювалось.
 *
 * @param {string} body
 * @param {'checkbox'|'radio'} type
 * @returns {string}
 */
export function retypeBody(body, type) {
	const open = type === 'radio' ? '(' : '[';
	const close = type === 'radio' ? ')' : ']';
	const forbidden = type === 'radio' ? ')' : ']';

	return (
		String(body || '')
		.split(/\r?\n/)
		.map(function (line) {
			if (isImageRef(line)) return line;

			const answer = matchAnswer(line);

			if (!answer || !answer.value) return line;

			if (answer.value.includes(forbidden)) {
				// інакше значення саме себе закрило б і група стала б нечитабельною
				throw {type: 'retype_conflict', value: answer.value, bracket: forbidden};
			}

			const indent = line.match(/^\s*/)[0];
			const label = line.replace(/^\s*(?:\[[^\]]+\]|\([^)]+\))\+?/, '');

			return indent + open + answer.value + close + (answer.text ? '+' : '') + label;
		})
		.join('\n')
	);
}

/**
 * Розбирає сегмент у групу. Повертає null, якщо в сегменті немає відповідей —
 * тоді це проза, а не група.
 *
 * @param {string[]} lines
 * @param {{file?: string, seen?: string[]}} [ctx]
 * @returns {{type: 'checkbox'|'radio', values: string[], texts: string[], min: number, max: number, explicitRange: boolean, bodyLines: string[]}|null}
 */
export function parseSegment(lines, ctx = {}) {
	const file = ctx.file;
	const seen = ctx.seen || [];

	const group = {
		type: '',
		values: [],
		texts: [],
		min: null,
		max: null,
		bodyLines: [],
	};

	for (const line of lines) {
		const directive = line.match(DIRECTIVE_RE);

		if (directive) {
			if (group.min !== null) {
				throw {type: 'duplicate_range', file, line};
			}

			group.min = Number(directive[1]);
			group.max = Number(directive[2]);
			continue;
		}

		group.bodyLines.push(line);

		if (!looksLikeAnswer(line) || isImageRef(line)) continue;

		const answer = matchAnswer(line);

		if (!answer) {
			throw {type: 'invalid_closing_bracket', file, line};
		}

		if (!answer.value) {
			throw {type: 'empty_value', file, line};
		}

		if (seen.includes(answer.value) || group.values.includes(answer.value)) {
			throw {type: 'value_duplicate', file, line};
		}

		if (group.type && group.type !== answer.type) {
			throw {type: 'mix_types', file, line};
		}

		group.type = answer.type;
		group.values.push(answer.value);

		if (answer.text) {
			group.texts.push(answer.value);
		}
	}

	if (!group.type) return null;

	// чи обмеження стояло у файлі явно — конструктор по цьому виставляє галочку
	// «Обмежити кількість відповідей»; після applyRangeDefaults вже не відрізнити
	group.explicitRange = group.min !== null;

	applyRangeDefaults(group, file);

	return group;
}

/**
 * Дефолти: checkbox — від 1 до кількості варіантів, radio — рівно один.
 *
 * @param {{type: string, values: string[], min: number|null, max: number|null}} group
 * @param {string} [file]
 */
function applyRangeDefaults(group, file) {
	const count = group.values.length;

	if (group.min === null) {
		group.min = 1;
		group.max = group.type === 'radio' ? 1 : count;

		return;
	}

	if (group.type === 'radio' && group.max > 1) {
		// тихе обрізання до 1 зробило б так, що конструктор показує «до 3»,
		// а сайт дозволяє лише 1 — тобто UI брехав би
		throw {type: 'invalid_range', file, range: [group.min, group.max]};
	}

	if (group.min > group.max) {
		throw {type: 'invalid_range', file, range: [group.min, group.max]};
	}

	if (group.max > count) {
		throw {type: 'invalid_range', file, range: [group.min, group.max]};
	}
}

/**
 * Повний розбір файлу опитування.
 *
 * @param {string} md
 * @param {string} [file] шлях для повідомлень про помилки
 * @returns {{expire: string|null, public: boolean, draft: boolean, values: string[], groups: Array<{type: string, values: string[], min: number, max: number}>}}
 */
export function parsePoll(md, file) {
	const {data, body} = stripFrontmatter(md.replace(ESCAPED_RE, '[$1]'));

	const poll = {
		expire: data.expire ? formatDate(data.expire) : null,
		public: !!data.public,
		draft: !!data.draft,
		values: [],
		groups: [],
	};

	for (const lines of splitSegments(body)) {
		const group = parseSegment(lines, {file, seen: poll.values});

		if (!group) continue;

		poll.values.push(...group.values);

		poll.groups.push({
			type: group.type,
			values: group.values,
			min: group.min,
			max: group.max,
		});
	}

	return poll;
}

/**
 * Розбирає файл у структуру для конструктора адмінки.
 *
 * @param {string} md
 * @param {string} [file]
 * @returns {{title: string, intro: string, groups: Array<{body: string, min: number, max: number, explicitRange: boolean, type: string}>, outro: string, hideQuestions: boolean, images: Object<string, string>, expire: string|null, public: boolean, draft: boolean}}
 */
export function toStructure(md, file) {
	const {data, body: withDefs} = stripFrontmatter(md);
	const {body: raw, images} = extractImageDefs(withDefs);
	const {body, hidden} = stripDetails(raw);
	const segments = splitSegments(body);

	const struct = {
		title: '',
		intro: '',
		groups: [],
		outro: '',
		hideQuestions: hidden,
		images,
		expire: data.expire ? formatDate(data.expire) : null,
		public: !!data.public,
		draft: !!data.draft,
	};

	const seen = [];

	segments.forEach(function (lines, index) {
		let rest = lines;

		if (index === 0) {
			const head = splitHead(lines);

			struct.title = head.title;
			struct.intro = head.intro;
			rest = head.rest;
		}

		const group = parseSegment(rest, {file, seen});

		if (!group) {
			// хвостовий сегмент без жодного варіанта — це текст результатів,
			// який показується після всіх питань. Проза посеред файлу лишається
			// нічиєю, як і була: конструктор не має куди її покласти
			if (index > 0 && index === segments.length - 1) {
				struct.outro = trimBlankLines(rest).join('\n');
			}

			return;
		}

		seen.push(...group.values);

		struct.groups.push({
			type: group.type,
			body: trimBlankLines(group.bodyLines).join('\n'),
			min: group.min,
			max: group.max,
			explicitRange: group.explicitRange,
		});
	});

	return struct;
}

/**
 * Відділяє заголовок і вступний текст від першої групи.
 *
 * @param {string[]} lines
 * @returns {{title: string, intro: string, rest: string[]}}
 */
function splitHead(lines) {
	let title = '';
	let start = 0;

	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(/^\s*##\s+(.+?)\s*$/);

		if (match) {
			title = match[1];
			start = i + 1;
			break;
		}

		if (lines[i].trim() !== '') break; // перший непорожній рядок не заголовок
	}

	const rest = lines.slice(start);

	// вступ — усе до першого рядка, що є відповіддю або директивою. Визначення
	// картинки `[x]: адреса` теж починається з дужки, але відповіддю не є — як і
	// в parseSegment
	let split = rest.length;

	for (let i = 0; i < rest.length; i++) {
		if ((looksLikeAnswer(rest[i]) && !isImageRef(rest[i])) || DIRECTIVE_RE.test(rest[i])) {
			split = i;
			break;
		}
	}

	return {
		title,
		intro: trimBlankLines(rest.slice(0, split)).join('\n'),
		rest: rest.slice(split),
	};
}

/**
 * Збирає .md з структури конструктора. Пара до toStructure.
 *
 * @param {{title?: string, intro?: string, groups?: Array<{body: string, min?: number|null, max?: number|null}>, outro?: string, hideQuestions?: boolean, images?: Object<string, string>, expire?: string|null, public?: boolean, draft?: boolean}} struct
 * @returns {string}
 */
export function fromStructure(struct) {
	const lines = ['---'];

	if (struct.expire) {
		lines.push('expire: ' + formatDate(struct.expire));
	}

	lines.push('public: ' + (struct.public ? 'true' : 'false'));
	lines.push('draft: ' + (struct.draft ? 'true' : 'false'));
	lines.push('---');

	const groups = (struct.groups || []).map(function (group) {
		// директива береться з полів форми, тому з тіла її прибираємо —
		// інакше вписана вручну дала б duplicate_range при наступному розборі
		const body = (
			(group.body || '')
			.split(/\r?\n/)
			.filter(line => !DIRECTIVE_RE.test(line))
			.join('\n')
			.trim()
		);
		const parsed = parseSegment(body.split(/\r?\n/));
		const count = parsed ? parsed.values.length : 0;
		const type = parsed ? parsed.type : 'checkbox';

		const min = group.min === null || group.min === undefined ? 1 : Number(group.min);
		const max = (
			group.max === null || group.max === undefined ?
				(type === 'radio' ? 1 : count) :
				Number(group.max)
		);

		const isDefault = min === 1 && max === (type === 'radio' ? 1 : count);

		return (
			isDefault ?
				body :
				'{' + min + '-' + max + '}\n' + body
		);
	});

	const outro = String(struct.outro || '').trim();

	// порожні рядки всередині обгортки обовʼязкові: без них markdown вважає
	// вміст <details> суцільним HTML-блоком і не розбирає варіанти
	const questions = (
		struct.hideQuestions ?
			'<details>\n<summary>' + SUMMARY_TEXT + '</summary>\n\n' +
			groups.join(GROUP_SEPARATOR) +
			'\n\n</details>' :
			groups.join(GROUP_SEPARATOR)
	);

	// Блоки розділяємо порожнім рядком. Без нього вступний текст і перше
	// питання злипаються в один абзац markdown, і варіанти рендеряться всередині
	// того ж <p>, що й проза
	const body = [
		struct.title ? '## ' + struct.title.trim() : '',
		struct.intro ? struct.intro.trim() : '',
		questions,
	];

	// текст результатів іде через той самий розділювач, що й питання: інакше він
	// прилипне до останньої групи і при наступному розборі стане її підписом
	const tail = outro ? GROUP_SEPARATOR + outro : '';

	// Визначення картинок — у самому кінці. Пишуться лише ті, на які текст
	// справді посилається: прибраний з тексту токен прибирає і визначення, і
	// саме по різниці визначень сервер розуміє, який файл видалити
	const text = [struct.intro || '', ...(struct.groups || []).map(group => group.body || ''), outro].join('\n');
	const defs = [];

	for (const id of findImageRefs(text)) {
		const url = struct.images?.[id];

		if (typeof url !== 'string' || !url) continue;

		defs.push('[' + id + ']: ' + url);
	}

	const images = defs.length > 0 ? '\n\n' + defs.join('\n') : '';

	return lines.join('\n') + '\n\n' + body.filter(part => !!part).join('\n\n') + tail + images + '\n';
}

/**
 * @param {string} slug
 * @returns {Promise<string>}
 */
export async function readPollFile(slug) {
	return readFile(pollPath(slug), 'utf8');
}

/**
 * Читання за шляхом відносно POLLS_DIR — потрібне для файлів у підтеках, до яких
 * slug не застосовний.
 *
 * @param {string} filepath
 * @returns {Promise<string>}
 */
export async function readPollFileByPath(filepath) {
	const path = resolve(POLLS_DIR, filepath);

	if (relative(POLLS_DIR, path).startsWith('..')) {
		throw {type: 'invalid_path', file: filepath};
	}

	return readFile(path, 'utf8');
}

/**
 * @param {string} slug
 * @param {string} md
 * @returns {Promise<void>}
 */
export async function writePollFile(slug, md) {
	return writeFile(pollPath(slug), md, 'utf8');
}

/**
 * @param {string} slug
 * @returns {Promise<void>}
 */
export async function deletePollFile(slug) {
	return unlink(pollPath(slug));
}

/**
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
export async function pollFileExists(slug) {
	const list = await listPollFiles();

	return list.includes(slug + '.md');
}

const TRANSLIT = {
	а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
	з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
	о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
	ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ʼ: '', "'": '',
};

/**
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
	const slug = (
		String(title || '')
		.toLowerCase()
		.split('')
		.map(ch => TRANSLIT.hasOwnProperty(ch) ? TRANSLIT[ch] : ch)
		.join('')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	);

	return slug || 'poll';
}

/**
 * @param {Date|string} value
 * @returns {string} YYYY-MM-DD
 */
function formatDate(value) {
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}

	return String(value).slice(0, 10);
}

/**
 * @param {string[]} lines
 * @returns {string[]}
 */
function trimBlankLines(lines) {
	const copy = lines.slice();

	while (copy.length && copy[0].trim() === '') copy.shift();
	while (copy.length && copy[copy.length - 1].trim() === '') copy.pop();

	return copy;
}
