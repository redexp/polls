import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {processor} from '../src/lib/processor.js';
import {fromStructure, stripFrontmatter} from '../server/models/pollFile.js';

let renderer;

before(async function () {
	renderer = await processor.createRenderer({});
});

/**
 * @param {string} md
 * @returns {Promise<string>}
 */
async function render(md) {
	const {code} = await renderer.render(stripFrontmatter(md).body);

	return code;
}

test('{min-max} стає data-min/data-max і зникає з тексту', async function () {
	const html = await render('{1-2}\n[a] Один\n[b] Два\n[c] Три\n');

	assert.ok(html.includes('data-min="1"'), html);
	assert.ok(html.includes('data-max="2"'), html);
	assert.ok(!html.includes('{1-2}'), 'директива не має потрапити в розмітку: ' + html);
});

test('директива в окремому абзаці не лишає порожнього <p>', async function () {
	const html = await render('{1-2}\n\n[a] Один\n[b] Два\n');

	assert.ok(html.includes('data-max="2"'), html);
	assert.ok(!html.includes('<p></p>'), html);
	assert.ok(!html.includes('{1-2}'), html);
});

test('група без директиви не отримує обмежень — дефолти лишаються клієнту', async function () {
	const html = await render('[a] Один\n[b] Два\n');

	assert.ok(!html.includes('data-min'), html);
	assert.ok(!html.includes('data-max'), html);
});

test('[val]+ додає textarea, значення лишається без плюса', async function () {
	const html = await render('[робота-інше]+ Свій варіант\n[дім] Дім\n');

	assert.ok(html.includes('value="робота-інше"'), html);
	assert.ok(!html.includes('value="робота-інше+"'), html);
	assert.ok(html.includes('<textarea class="form-control" name="робота-інше"'), html);

	// у варіанта без + поля тексту немає
	assert.equal(html.match(/<textarea/g).length, 1, html);
});

test('розділювач із генератора дає <hr> і дві групи', async function () {
	const md = fromStructure({
		title: 'T',
		intro: 'Проза',
		groups: [{body: '[a] A\n[b] B'}, {body: '(y) Так\n(n) Ні'}],
	});

	const html = await render(md);

	assert.ok(html.includes('<hr>'), html);
	assert.ok(html.includes('data-group="0"'), html);
	assert.ok(html.includes('data-group="1"'), html);
	assert.ok(html.includes('type="checkbox"'), html);
	assert.ok(html.includes('type="radio"'), html);
});

test('обмеження прозою більше не читається', async function () {
	const html = await render('Оберіть 3 варіанти\n\n[a] A\n[b] B\n[c] C\n[d] D\n');

	assert.ok(!html.includes('data-max'), 'проза не має задавати обмеження: ' + html);
});
