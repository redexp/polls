import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapImageFields} from '../server/admin/imageFields.js';

/**
 * @param {string[]} ids
 */
function files(ids) {
	return ids.map(id => ({fieldname: id, buffer: Buffer.from(id)}));
}

let seq = 0;

function newName() {
	return String(++seq).padStart(16, '0') + '.webp';
}

test('назва поля стає id, кожен файл отримує власне ім\'я', function () {
	seq = 0;

	const images = mapImageFields(files(['ab12cd34', 'ef56gh78']), new Set(), newName);

	assert.deepEqual([...images.keys()], ['ab12cd34', 'ef56gh78']);
	assert.notEqual(images.get('ab12cd34').name, images.get('ef56gh78').name);
	assert.deepEqual(images.get('ab12cd34').buffer, Buffer.from('ab12cd34'));
});

test('без файлів — порожня мапа, і req.files може бути відсутнім', function () {
	assert.equal(mapImageFields([], new Set(), newName).size, 0);
	assert.equal(mapImageFields(undefined, new Set(), newName).size, 0);
});

test('повторений id — помилка, а не мовчазна підміна картинки', function () {
	assert.throws(
		() => mapImageFields(files(['ab12cd34', 'ab12cd34']), new Set(), newName),
		err => err.type === 'invalid_body'
	);
});

test('id, що вже має збережену адресу, — помилка', function () {
	assert.throws(
		() => mapImageFields(files(['ab12cd34']), new Set(['ab12cd34']), newName),
		err => err.type === 'invalid_body'
	);
});

test('id не тієї форми — помилка', function () {
	for (const id of ['', 'a b', '../x', 'a/b', 'a'.repeat(65), 'файл']) {
		assert.throws(
			() => mapImageFields(files([id]), new Set(), newName),
			err => err.type === 'invalid_body',
			JSON.stringify(id)
		);
	}
});
