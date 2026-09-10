import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
	fromStructure,
	toStructure,
	parsePoll,
	splitSegments,
	matchAnswer,
	slugify,
	hasProseRange,
} from '../server/models/pollFile.js';

const STRUCT = {
	title: 'Заголовок опитування',
	intro: 'Текст опитування',
	groups: [
		{
			body: '[перша] Відповідь 1\n[друга] Відповідь 2\n[інше]+ Свій варіант',
			min: 1,
			max: 2,
		},
		{
			body: '(так) Так\n(ні) Ні',
			min: 0,
			max: 1,
		},
	],
	expire: '2027-12-31',
	public: true,
	draft: false,
};

test('round-trip: структура → md → структура', function () {
	const md = fromStructure(STRUCT);
	const back = toStructure(md);

	assert.equal(back.title, STRUCT.title);
	assert.equal(back.intro, STRUCT.intro);
	assert.equal(back.expire, '2027-12-31');
	assert.equal(back.public, true);
	assert.equal(back.draft, false);

	assert.equal(back.groups.length, 2);

	assert.equal(back.groups[0].body, STRUCT.groups[0].body);
	assert.equal(back.groups[0].type, 'checkbox');
	assert.equal(back.groups[0].min, 1);
	assert.equal(back.groups[0].max, 2);

	assert.equal(back.groups[1].body, STRUCT.groups[1].body);
	assert.equal(back.groups[1].type, 'radio');
	assert.equal(back.groups[1].min, 0);
	assert.equal(back.groups[1].max, 1);

	// друга ітерація не має нічого змінювати
	assert.equal(fromStructure(back), md);
});

test('round-trip: дефолтне обмеження директиви не породжує', function () {
	const md = fromStructure({
		title: 'T',
		intro: '',
		groups: [{body: '[a] A\n[b] B', min: 1, max: 2}],
		public: false,
		draft: false,
	});

	assert.ok(!md.includes('{'), 'директива не потрібна, бо це дефолт: ' + md);

	const back = toStructure(md);

	assert.equal(back.groups[0].min, 1);
	assert.equal(back.groups[0].max, 2);
});

test('розділювач груп відділений порожніми рядками', function () {
	const md = fromStructure(STRUCT);

	// `---` одразу під рядком тексту markdown розбирає як setext-заголовок H2,
	// а не як <hr>, і група не розділиться
	assert.ok(md.includes('\n\n-------------------\n\n'), md);
	assert.equal(parsePoll(md).groups.length, 2);
});

test('розділювач без порожнього рядка перед ним не ділить групу', function () {
	const md = [
		'## T',
		'',
		'[a] A',
		'---',
		'[b] B',
		'',
	].join('\n');

	// це setext-заголовок для рендеру, тому сервер теж не має бачити тут межу
	assert.equal(splitSegments(md).length, 1);
});

test('{min-max}: розбір і дефолти', function () {
	const withDirective = parsePoll('{0-2}\n[a] A\n[b] B\n[c] C\n');

	assert.equal(withDirective.groups[0].min, 0);
	assert.equal(withDirective.groups[0].max, 2);

	const checkbox = parsePoll('[a] A\n[b] B\n[c] C\n');

	assert.equal(checkbox.groups[0].min, 1);
	assert.equal(checkbox.groups[0].max, 3, 'checkbox без директиви — без обмеження');

	const radio = parsePoll('(a) A\n(b) B\n');

	assert.equal(radio.groups[0].min, 1);
	assert.equal(radio.groups[0].max, 1);
});

test('{min-max} з max > 1 на radio-групі — помилка, не тихе обрізання', function () {
	assert.throws(
		() => parsePoll('{1-3}\n(a) A\n(b) B\n(c) C\n'),
		err => err.type === 'invalid_range'
	);
});

test('{min-max}: min > max і max більше за кількість варіантів', function () {
	assert.throws(() => parsePoll('{3-1}\n[a] A\n[b] B\n[c] C\n'), err => err.type === 'invalid_range');
	assert.throws(() => parsePoll('{1-5}\n[a] A\n[b] B\n'), err => err.type === 'invalid_range');
});

test('дві директиви в одній групі — помилка', function () {
	assert.throws(
		() => parsePoll('{1-2}\n{1-3}\n[a] A\n[b] B\n[c] C\n'),
		err => err.type === 'duplicate_range'
	);
});

test('[val]+ : значення лишається без плюса', function () {
	const poll = parsePoll('[робота-інше]+ Свій варіант\n[дім] Дім\n');

	assert.deepEqual(poll.values, ['робота-інше', 'дім']);

	const answer = matchAnswer('[робота-інше]+ Свій варіант');

	assert.equal(answer.value, 'робота-інше');
	assert.equal(answer.text, true);

	assert.equal(matchAnswer('[дім] Дім').text, false);
});

test('image ref не вважається варіантом', function () {
	assert.equal(matchAnswer('[image]: <data:image/png;base64,xxx>'), null);

	const poll = parsePoll('[image]: <data:image/png;base64,xxx>\n[a] A\n');

	assert.deepEqual(poll.values, ['a']);
});

test('помилки синтаксису', function () {
	assert.throws(() => parsePoll('[a] A\n(b) B\n'), err => err.type === 'mix_types');
	assert.throws(() => parsePoll('[a] A\n[a] A2\n'), err => err.type === 'value_duplicate');
	assert.throws(() => parsePoll('[ ] A\n'), err => err.type === 'empty_value');
	assert.throws(() => parsePoll('[a A\n'), err => err.type === 'invalid_closing_bracket');
});

test('значення унікальні між групами', function () {
	const md = fromStructure({
		title: 'T',
		groups: [{body: '[a] A'}, {body: '[a] A'}],
	});

	assert.throws(() => parsePoll(md), err => err.type === 'value_duplicate');
});

test('frontmatter: expire, public, draft', function () {
	const poll = parsePoll('---\nexpire: 2027-12-31\npublic: true\ndraft: true\n---\n\n[a] A\n');

	assert.equal(poll.expire, '2027-12-31');
	assert.equal(poll.public, true);
	assert.equal(poll.draft, true);
});

test('обмеження прозою розпізнається лише як попередження', function () {
	const body = 'Оберіть 3 варіанти\n\n[a] A\n[b] B\n[c] C\n';

	assert.equal(hasProseRange(body), true);

	// але на обмеження групи більше не впливає
	assert.equal(parsePoll(body).groups[0].max, 3, 'max = кількість варіантів, а не 3 з прози');
	assert.equal(parsePoll('Оберіть 2 варіанти\n\n[a] A\n[b] B\n[c] C\n').groups[0].max, 3);
});

test('slugify: транслітерація', function () {
	assert.equal(slugify('Питання про Черкаси'), 'pytannia-pro-cherkasy');
	assert.equal(slugify('Їжак — 2027!'), 'izhak-2027');
	assert.equal(slugify(''), 'poll');
});

test('вступний текст відділяється від першої групи', function () {
	const struct = toStructure('## Т\n\nПерший абзац\n\nДругий абзац\n\n[a] A\n');

	assert.equal(struct.title, 'Т');
	assert.equal(struct.intro, 'Перший абзац\n\nДругий абзац');
	assert.equal(struct.groups[0].body, '[a] A');
});
