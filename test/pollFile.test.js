import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
	fromStructure,
	toStructure,
	parsePoll,
	splitSegments,
	matchAnswer,
	retypeBody,
	slugify,
	findImageRefs,
	findDefinedIds,
	imageFilesOf,
	imageNameFromUrl,
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

test('блоки відділені порожнім рядком', function () {
	const md = fromStructure(STRUCT);

	// без порожнього рядка вступний текст і перше питання злипаються в один
	// абзац markdown, і варіанти опиняються всередині того ж <p>, що й проза
	assert.match(md, /^---\n[\s\S]*?\n---\n\n## /, 'порожній рядок після frontmatter: ' + md);
	assert.match(md, /Текст опитування\n\n\{1-2\}\n\[перша\]/, 'порожній рядок перед питанням: ' + md);

	assert.ok(!md.includes('\n\n\n'), 'зайвих порожніх рядків бути не має: ' + md);
});

test('без вступного тексту зайвого порожнього рядка не лишається', function () {
	const md = fromStructure({
		title: 'T',
		intro: '',
		groups: [{body: '[a] A'}],
	});

	assert.match(md, /^---\n[\s\S]*?\n---\n\n## T\n\n\[a\] A\n$/, md);
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

test('обмеження прозою більше не впливає на групу', function () {
	const body = 'Оберіть 3 варіанти\n\n[a] A\n[b] B\n[c] C\n';

	assert.equal(parsePoll(body).groups[0].max, 3, 'max = кількість варіантів, а не 3 з прози');
	assert.equal(parsePoll('Оберіть 2 варіанти\n\n[a] A\n[b] B\n[c] C\n').groups[0].max, 3);
});

test('explicitRange відрізняє задане обмеження від дефолтного', function () {
	// конструктор по цьому виставляє галочку «Обмежити кількість відповідей»
	const withDirective = toStructure('## T\n\n{1-2}\n[a] A\n[b] B\n[c] C\n');

	assert.equal(withDirective.groups[0].explicitRange, true);
	assert.equal(withDirective.groups[0].min, 1);
	assert.equal(withDirective.groups[0].max, 2);

	const plain = toStructure('## T\n\n[a] A\n[b] B\n[c] C\n');

	assert.equal(plain.groups[0].explicitRange, false);
	assert.equal(plain.groups[0].min, 1, 'дефолти все одно обчислені');
	assert.equal(plain.groups[0].max, 3);
});

test('retypeBody: перемикання типу відповіді переписує дужки', function () {
	const checkbox = 'Проза лишається\n[перша] Відповідь 1\n[інше]+ Свій варіант\n';

	assert.equal(
		retypeBody(checkbox, 'radio'),
		'Проза лишається\n(перша) Відповідь 1\n(інше)+ Свій варіант\n'
	);

	assert.equal(
		retypeBody('(так) Так\n(ні) Ні\n', 'checkbox'),
		'[так] Так\n[ні] Ні\n'
	);

	// значення і `+` зберігаються, тому голоси в БД лишаються придатними
	assert.deepEqual(parsePoll(retypeBody(checkbox, 'radio')).values, ['перша', 'інше']);
});

test('retypeBody: той самий тип нічого не змінює', function () {
	const body = '[a] A\n[b]+ B\n';

	assert.equal(retypeBody(body, 'checkbox'), body);
});

test('retypeBody: не чіпає image ref і зберігає відступ', function () {
	assert.equal(
		retypeBody('[image]: <data:image/png;base64,xxx>\n  [a] A\n', 'radio'),
		'[image]: <data:image/png;base64,xxx>\n  (a) A\n'
	);
});

test('retypeBody: значення з дужкою — помилка, а не зламаний файл', function () {
	assert.throws(
		() => retypeBody('[a)b] A\n', 'radio'),
		function (err) {
			assert.equal(err.type, 'retype_conflict');
			assert.equal(err.value, 'a)b');
			return true;
		}
	);

	// у зворотний бік так само
	assert.throws(() => retypeBody('(a]b) A\n', 'checkbox'), err => err.type === 'retype_conflict');
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

const RESULTS = {
	title: 'Заголовок',
	intro: 'Вступ',
	groups: [
		{body: '[a] A\n[b] B', min: 1, max: null},
		{body: '(c) C\n(d) D', min: 1, max: 1},
	],
	outro: 'Ось **результати**.',
	hideQuestions: true,
	expire: null,
	public: false,
	draft: false,
};

test('round-trip: текст результатів і сховані питання', function () {
	const md = fromStructure(RESULTS);
	const back = toStructure(md);

	assert.equal(back.outro, RESULTS.outro);
	assert.equal(back.hideQuestions, true);

	// обгортка не має потрапити ні в тіло питання, ні в текст результатів
	assert.equal(back.groups.length, 2);
	assert.equal(back.groups[0].body, RESULTS.groups[0].body);
	assert.equal(back.groups[1].body, RESULTS.groups[1].body);

	assert.equal(fromStructure(back), md);
});

test('обидва перемикачі незалежні', function () {
	const onlyOutro = toStructure(fromStructure({...RESULTS, hideQuestions: false}));

	assert.equal(onlyOutro.outro, RESULTS.outro);
	assert.equal(onlyOutro.hideQuestions, false);
	assert.equal(onlyOutro.groups.length, 2);

	const onlyHidden = toStructure(fromStructure({...RESULTS, outro: ''}));

	assert.equal(onlyHidden.outro, '');
	assert.equal(onlyHidden.hideQuestions, true);
	assert.equal(onlyHidden.groups.length, 2);

	const neither = toStructure(fromStructure({...RESULTS, outro: '', hideQuestions: false}));

	assert.equal(neither.outro, '');
	assert.equal(neither.hideQuestions, false);
	assert.ok(!fromStructure({...RESULTS, outro: '', hideQuestions: false}).includes('<details'));
});

test('текст результатів відділений розділювачем від останньої групи', function () {
	const md = fromStructure({...RESULTS, hideQuestions: false});

	assert.ok(md.includes('(c) C\n(d) D\n\n-------------------\n\nОсь **результати**.'));
});

test('сховані питання лишаються питаннями для валідації', function () {
	const parsed = parsePoll(fromStructure(RESULTS));

	assert.deepEqual(parsed.values, ['a', 'b', 'c', 'd']);
	assert.equal(parsed.groups.length, 2);
});

test('одна група: текст результатів не злипається з нею', function () {
	const md = fromStructure({...RESULTS, groups: [RESULTS.groups[0]]});
	const back = toStructure(md);

	assert.equal(back.groups.length, 1);
	assert.equal(back.groups[0].body, '[a] A\n[b] B');
	assert.equal(back.outro, RESULTS.outro);
});

test('проза посеред файлу текстом результатів не стає', function () {
	const struct = toStructure(
		'## Т\n\n[a] A\n\n-------------------\n\nПроза\n\n-------------------\n\n[b] B\n'
	);

	assert.equal(struct.outro, '');
	assert.equal(struct.groups.length, 2);
});

const IMAGES = {
	k1: '/img/polls/0123456789abcdef.webp',
	k2: '/img/polls/fedcba9876543210.webp',
	k3: '/img/polls/00000000000000aa.webp',
};

// картинка у другому питанні, а не в першому: проза перед варіантами першого
// питання від вступу не відрізняється і при читанні файлу переходить у вступ
const WITH_IMAGES = {
	title: 'Заголовок',
	intro: 'Вступ\n\n![Картинка 1][k1]',
	groups: [
		{body: '[a] A\n[b] B', min: 1, max: null},
		{body: 'Питання\n\n![Картинка 2][k2]\n\n(c) C\n(d) D', min: 1, max: 1},
	],
	outro: 'Підсумок\n\n![Картинка 3][k3]',
	hideQuestions: false,
	images: IMAGES,
	expire: null,
	public: false,
	draft: false,
};

test('картинки: визначення пишуться в кінець файлу і повертаються мапою', function () {
	const md = fromStructure(WITH_IMAGES);

	assert.ok(
		md.endsWith('\n\n[k1]: /img/polls/0123456789abcdef.webp\n[k2]: /img/polls/fedcba9876543210.webp\n[k3]: /img/polls/00000000000000aa.webp\n'),
		md
	);

	const back = toStructure(md);

	assert.deepEqual(back.images, IMAGES);
	assert.equal(back.intro, WITH_IMAGES.intro);
	assert.equal(back.groups[0].body, WITH_IMAGES.groups[0].body);
	assert.equal(back.groups[1].body, WITH_IMAGES.groups[1].body);
	assert.equal(back.outro, WITH_IMAGES.outro, 'визначення не мають потрапити в текст результатів');

	assert.equal(fromStructure(back), md);
});

test('картинки: без тексту результатів визначення не потрапляють у тіло останнього питання', function () {
	const struct = {...WITH_IMAGES, outro: ''};
	const back = toStructure(fromStructure(struct));

	assert.equal(back.groups[1].body, WITH_IMAGES.groups[1].body);
	assert.deepEqual(Object.keys(back.images).sort(), ['k1', 'k2']);
});

test('картинки: зі схованими питаннями визначення стоять після </details>', function () {
	const struct = {...WITH_IMAGES, hideQuestions: true};
	const md = fromStructure(struct);

	assert.match(md, /<\/details>\n\n-------------------\n\nПідсумок[\s\S]*\n\n\[k1\]: /);

	const back = toStructure(md);

	assert.equal(back.hideQuestions, true);
	assert.equal(back.groups.length, 2);
	assert.deepEqual(back.images, IMAGES);
	assert.equal(fromStructure(back), md);
});

test('картинки: непотрібне визначення не пишеться, а без мапи — жодного', function () {
	// токен k3 з тексту прибрали, визначення має зникнути разом з ним —
	// саме по різниці визначень сервер знаходить файли на видалення
	const md = fromStructure({...WITH_IMAGES, outro: 'Підсумок без картинки'});

	assert.ok(!md.includes('[k3]:'), md);
	assert.ok(md.includes('[k1]:') && md.includes('[k2]:'), md);

	const plain = fromStructure({...WITH_IMAGES, images: {}});

	assert.ok(!plain.includes(']: /img/polls/'), plain);
	assert.ok(plain.includes('![Картинка 1][k1]'), 'токен у тексті лишається як є');
});

test('картинки: визначення не ламають розбір варіантів', function () {
	const md = fromStructure(WITH_IMAGES);
	const parsed = parsePoll(md);

	assert.deepEqual(parsed.values, ['a', 'b', 'c', 'd']);
	assert.equal(parsed.groups.length, 2);
});

test('картинки: чуже визначення лишається в тексті', function () {
	// написане руками посилання не з /img/polls/ адмінка не чіпає
	const body = 'Текст\n\n![Схема][ext]\n\n[ext]: https://example.com/a.png\n\n[a] A';
	const back = toStructure('## T\n\n' + body + '\n');

	assert.deepEqual(back.images, {});
	assert.ok(back.intro.includes('[ext]: https://example.com/a.png'));
	assert.deepEqual(findDefinedIds(body), ['ext']);
});

test('картинки: пошук посилань і імен файлів', function () {
	assert.deepEqual(findImageRefs('![a][x] текст ![b][y] ![c][x]'), ['x', 'y']);
	assert.deepEqual(findImageRefs('![inline](/img/polls/a.webp)'), [], 'інлайнова картинка — не посилальна');

	assert.deepEqual(
		imageFilesOf(fromStructure(WITH_IMAGES)),
		['0123456789abcdef.webp', 'fedcba9876543210.webp', '00000000000000aa.webp']
	);

	assert.equal(imageNameFromUrl('/img/polls/abc.webp'), 'abc.webp');
	assert.equal(imageNameFromUrl('https://evil/img/polls/abc.webp'), null);
	assert.equal(imageNameFromUrl(42), null);
});
