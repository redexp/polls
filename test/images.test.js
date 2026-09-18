import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

const root = mkdtempSync(resolve(tmpdir(), 'polls-images-'));
const uploads = resolve(root, 'uploads');

// тека читається при завантаженні конфігу, тому імпорт — динамічний
process.env.UPLOADS_DIR = uploads;

/** @type {typeof import('../server/models/images.js')} */
let Images;
/** @type {typeof import('sharp').default} */
let sharp;

before(async function () {
	Images = await import('../server/models/images.js');
	sharp = (await import('sharp')).default;
});

after(function () {
	rmSync(root, {recursive: true, force: true});
});

/**
 * @param {number} width
 * @param {number} height
 * @param {'png'|'jpeg'|'webp'|'gif'} format
 */
function picture(width, height, format) {
	return (
		sharp({create: {width, height, channels: 3, background: {r: 200, g: 30, b: 30}}})
		.toFormat(format)
		.toBuffer()
	);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {'png'|'jpeg'|'webp'|'gif'} format
 */
async function store(width, height, format) {
	const name = Images.newImageName();

	await Images.saveImage(await picture(width, height, format), name);

	return name;
}

test('ім\'я картинки: правильної форми і різне на кожен виклик', function () {
	const a = Images.newImageName();
	const b = Images.newImageName();

	assert.match(a, Images.IMAGE_NAME_RE);
	assert.match(b, Images.IMAGE_NAME_RE);
	assert.notEqual(a, b, 'дедуплікації немає свідомо: видалення за різницею безпечне');
});

test('запис: png стає webp під заданим іменем', async function () {
	const name = await store(40, 30, 'png');

	assert.ok(existsSync(resolve(uploads, name)));

	const meta = await sharp(readFileSync(resolve(uploads, name))).metadata();

	assert.equal(meta.format, 'webp');
	assert.equal(meta.width, 40);
});

test('запис: широка картинка ужимається до 1600px, вузька — не збільшується', async function () {
	const wide = await store(2400, 600, 'jpeg');
	const wideMeta = await sharp(readFileSync(resolve(uploads, wide))).metadata();

	assert.equal(wideMeta.width, 1600);
	assert.equal(wideMeta.height, 400);

	const small = await store(300, 200, 'webp');
	const smallMeta = await sharp(readFileSync(resolve(uploads, small))).metadata();

	assert.equal(smallMeta.width, 300);
});

test('запис: gif і не-картинка відхиляються за вмістом, файлу не лишається', async function () {
	const name = Images.newImageName();
	const gif = await picture(20, 20, 'gif');

	await assert.rejects(
		() => Images.saveImage(gif, name),
		err => err.type === 'image_type' && err.format === 'gif'
	);

	// розширення тут не існує взагалі — перевірка йде лише за вмістом
	await assert.rejects(
		() => Images.saveImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), name),
		err => err.type === 'image_type'
	);

	await assert.rejects(
		() => Images.saveImage(Buffer.from('просто текст'), name),
		err => err.type === 'image_type'
	);

	assert.ok(!existsSync(resolve(uploads, name)));
});

test('видалення: прибирає файли, відсутні не заважають', async function () {
	const name = await store(10, 10, 'png');

	// стороннє ім'я неправильної форми — ігнорується, а не стає шляхом
	writeFileSync(resolve(uploads, 'keep.txt'), 'x');

	await assert.doesNotReject(() => Images.removeImages([name, '1111111111111111.webp', '../keep.txt']));

	assert.ok(!existsSync(resolve(uploads, name)));
	assert.ok(existsSync(resolve(uploads, 'keep.txt')));
});

test('видалення: ім\'я не правильної форми ніколи не стає шляхом', async function () {
	writeFileSync(resolve(uploads, 'evil.webp'), 'x');

	await Images.removeImages(['../evil.webp', 'a/b.webp', 'abc.png', 'ABCDEF0123456789.webp', '']);

	assert.ok(existsSync(resolve(uploads, 'evil.webp')));
});
