import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, existsSync, writeFileSync, utimesSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

const root = mkdtempSync(resolve(tmpdir(), 'polls-images-'));
const uploads = resolve(root, 'uploads');
const tmp = resolve(root, 'tmp');

// теки читаються при завантаженні конфігу, тому імпорт — динамічний
process.env.UPLOADS_DIR = uploads;
process.env.UPLOADS_TMP_DIR = tmp;

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

test('завантаження: png стає webp у тимчасовій теці, ім\'я правильної форми', async function () {
	const name = await Images.storeUpload(await picture(40, 30, 'png'));

	assert.match(name, Images.IMAGE_NAME_RE);
	assert.ok(existsSync(resolve(tmp, name)), 'файл у тимчасовій теці');
	assert.ok(!existsSync(resolve(uploads, name)), 'а не в постійній');

	const meta = await sharp(resolve(tmp, name)).metadata();

	assert.equal(meta.format, 'webp');
	assert.equal(meta.width, 40);
});

test('завантаження: широка картинка ужимається до 1600px, вузька — не збільшується', async function () {
	const wide = await Images.storeUpload(await picture(2400, 600, 'jpeg'));
	const wideMeta = await sharp(resolve(tmp, wide)).metadata();

	assert.equal(wideMeta.width, 1600);
	assert.equal(wideMeta.height, 400);

	const small = await Images.storeUpload(await picture(300, 200, 'webp'));
	const smallMeta = await sharp(resolve(tmp, small)).metadata();

	assert.equal(smallMeta.width, 300);
});

test('завантаження: два однакові файли дають два різні імені', async function () {
	const buffer = await picture(20, 20, 'png');

	const a = await Images.storeUpload(buffer);
	const b = await Images.storeUpload(buffer);

	assert.notEqual(a, b, 'дедуплікації немає свідомо: видалення за різницею безпечне');
});

test('завантаження: gif і не-картинка відхиляються за вмістом', async function () {
	const gif = await picture(20, 20, 'gif');

	await assert.rejects(
		() => Images.storeUpload(gif),
		err => err.type === 'image_type' && err.format === 'gif'
	);

	// розширення тут не існує взагалі — перевірка йде лише за вмістом
	await assert.rejects(
		() => Images.storeUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
		err => err.type === 'image_type'
	);

	await assert.rejects(
		() => Images.storeUpload(Buffer.from('просто текст')),
		err => err.type === 'image_type'
	);
});

test('тимчасова тека: старші за годину файли зникають, свіжі лишаються', async function () {
	const fresh = await Images.storeUpload(await picture(10, 10, 'png'));
	const stale = await Images.storeUpload(await picture(10, 10, 'png'));

	const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

	utimesSync(resolve(tmp, stale), twoHoursAgo, twoHoursAgo);

	const removed = await Images.pruneTmp();

	assert.ok(removed.includes(stale));
	assert.ok(!existsSync(resolve(tmp, stale)));
	assert.ok(existsSync(resolve(tmp, fresh)));
});

test('перенос: файли з тимчасової теки стають постійними, постійні лишаються', async function () {
	const name = await Images.storeUpload(await picture(10, 10, 'png'));

	await Images.commitImages([name]);

	assert.ok(existsSync(resolve(uploads, name)));
	assert.ok(!existsSync(resolve(tmp, name)));

	// повторний перенос уже постійного файлу — не помилка
	await assert.doesNotReject(() => Images.commitImages([name]));
	assert.ok(existsSync(resolve(uploads, name)));
});

test('перенос: невідоме ім\'я — помилка, і жоден файл не рухається', async function () {
	const name = await Images.storeUpload(await picture(10, 10, 'png'));
	const before = readdirSync(uploads).length;

	await assert.rejects(
		() => Images.commitImages([name, '0000000000000000.webp']),
		function (err) {
			assert.equal(err.type, 'image_unknown');
			assert.deepEqual(err.names, ['0000000000000000.webp']);
			return true;
		}
	);

	assert.ok(existsSync(resolve(tmp, name)), 'перевірка йде до переносу');
	assert.equal(readdirSync(uploads).length, before);
});

test('перенос: ім\'я не правильної форми ніколи не стає шляхом', async function () {
	for (const name of ['../evil.webp', 'a/b.webp', 'abc.png', 'ABCDEF0123456789.webp', '']) {
		await assert.rejects(() => Images.commitImages([name]), err => err.type === 'image_unknown', name);
	}
});

test('видалення: прибирає постійні файли, відсутні не заважають', async function () {
	const name = await Images.storeUpload(await picture(10, 10, 'png'));

	await Images.commitImages([name]);

	// стороннє ім'я неправильної форми — ігнорується, а не стає шляхом
	writeFileSync(resolve(uploads, 'keep.txt'), 'x');

	await assert.doesNotReject(() => Images.removeImages([name, '1111111111111111.webp', '../keep.txt']));

	assert.ok(!existsSync(resolve(uploads, name)));
	assert.ok(existsSync(resolve(uploads, 'keep.txt')));
});
