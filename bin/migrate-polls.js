import minimist from 'minimist';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parse, stringify} from 'yaml';
import {POLLS_DIR} from '../server/config/index.js';
import {matchAnswer} from '../server/models/pollFile.js';

/**
 * Переводить існуючі опитування на новий синтаксис:
 *
 *   - значення на `-інше` отримують `+` (поле вільного тексту тепер явне)
 *   - обмеження з прози («Оберіть 3», «від 1 до 3 варіантів») стають {min-max};
 *     сама проза лишається — вона часто несе більше сенсу, ніж два числа
 *   - плоске поле frontmatter `optional` стає {0-N} на відповідних групах
 *
 * Значення в БД не змінюються: `+` дописується після дужки, тому
 * answers.value і statistic.value лишаються тими самими.
 *
 * Використання:
 *   node bin/migrate-polls.js            — записати зміни, зберігши .bak
 *   node bin/migrate-polls.js --dry      — лише показати, що змінилось би
 */

const args = minimist(process.argv.slice(2));
const DRY = !!args.dry;

const HR_RE = /^\s*-{3,}\s*$/;
const DIRECTIVE_RE = /^\s*\{\d+\s*-\s*\d+\}\s*$/;
const FRONTMATTER_RE = /^(---+\s*\r?\n)(.*?)(\r?\n---+\s*\r?\n)/s;

const files = (await readdir(POLLS_DIR, {recursive: true})).filter(f => f.endsWith('.md'));

let changed = 0;

for (const file of files) {
	const path = resolve(POLLS_DIR, file);
	const source = await readFile(path, 'utf8');
	const result = migrate(source);

	if (result.md === source) {
		console.log('—', file, 'без змін');
		continue;
	}

	changed++;

	console.log('*', file);

	for (const note of result.notes) {
		console.log('   ', note);
	}

	if (DRY) continue;

	await writeFile(path + '.bak', source, 'utf8');
	await writeFile(path, result.md, 'utf8');
}

console.log('\nфайлів:', files.length, '| змінено:', changed, DRY ? '(dry run, нічого не записано)' : '');

/**
 * @param {string} source
 * @returns {{md: string, notes: string[]}}
 */
function migrate(source) {
	const notes = [];

	let frontmatter = '';
	let optional = [];
	let body = source;

	const match = source.match(FRONTMATTER_RE);

	if (match) {
		const data = parse(match[2]) || {};

		if (Array.isArray(data.optional)) {
			optional = data.optional;

			delete data.optional;

			notes.push('прибрано frontmatter optional: ' + JSON.stringify(optional));
		}

		frontmatter = match[1] + stringify(data).trimEnd() + match[3];
		body = source.slice(match[0].length);
	}

	const out = [];
	let segment = [];

	const flush = () => {
		out.push(...migrateSegment(segment, optional, notes));
		segment = [];
	};

	const lines = body.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const isSeparator = HR_RE.test(line) && (i === 0 || lines[i - 1].trim() === '');

		if (isSeparator) {
			flush();
			out.push(line);
			continue;
		}

		segment.push(line);
	}

	flush();

	return {
		md: frontmatter + out.join('\n'),
		notes,
	};
}

/**
 * @param {string[]} lines
 * @param {string[]} optional
 * @param {string[]} notes
 * @returns {string[]}
 */
function migrateSegment(lines, optional, notes) {
	const values = [];
	let firstAnswer = -1;
	let hasDirective = false;

	const result = lines.map(function (line, i) {
		if (DIRECTIVE_RE.test(line)) {
			hasDirective = true;
			return line;
		}

		const answer = matchAnswer(line);

		if (!answer || !answer.value) return line;

		values.push(answer.value);

		if (firstAnswer < 0) {
			firstAnswer = i;
		}

		if (answer.text) return line; // вже має +

		if (!answer.value.endsWith('-інше')) return line;

		notes.push('додано + до варіанта ' + answer.value);

		return addPlus(line);
	});

	if (values.length === 0 || hasDirective || firstAnswer < 0) {
		return result;
	}

	const prose = findProseRange(lines.join('\n'));
	const isOptional = optional.some(prefix => values.some(value => value.startsWith(prefix)));

	if (!prose && !isOptional) {
		return result;
	}

	const min = isOptional ? 0 : (prose ? prose.min : 1);
	const max = prose ? prose.max : values.length;

	notes.push('додано обмеження {' + min + '-' + max + '}');

	result.splice(firstAnswer, 0, '{' + min + '-' + max + '}');

	return result;
}

/**
 * @param {string} line
 * @returns {string}
 */
function addPlus(line) {
	return line.replace(/^(\s*(?:\[[^\]]+\]|\([^)]+\)))/, '$1+');
}

/**
 * @param {string} text
 * @returns {{min: number, max: number}|null}
 */
function findProseRange(text) {
	const fromTo = text.match(/від\s+(\d+)\s+до\s+(\d+)\s+варіантів/);

	if (fromTo) {
		return {
			min: Number(fromTo[1]),
			max: Number(fromTo[2]),
		};
	}

	const max = text.match(/Оберіть\s+(\d+)/);

	if (max) {
		return {
			min: 1,
			max: Number(max[1]),
		};
	}

	return null;
}
