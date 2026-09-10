import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertValuesPreserved} from '../server/admin/valueGuard.js';
import {parsePoll} from '../server/models/pollFile.js';

const BEFORE = '## T\n\n[a] A\n[b] B\n\n-------------------\n\n(y) Так\n(n) Ні\n';

test('додавання варіанта дозволене — старі голоси лишаються валідними', function () {
	const next = parsePoll('## T\n\n[a] A\n[b] B\n[c] C\n\n-------------------\n\n(y) Так\n(n) Ні\n');

	assert.doesNotThrow(() => assertValuesPreserved(BEFORE, next, {a: 5, y: 5}));
});

test('видалення варіанта з голосами заборонене і повідомляє кількість', function () {
	const next = parsePoll('## T\n\n[a] A\n\n-------------------\n\n(y) Так\n(n) Ні\n');

	assert.throws(
		() => assertValuesPreserved(BEFORE, next, {a: 5, b: 3, y: 5}),
		function (err) {
			assert.equal(err.type, 'values_locked');
			assert.deepEqual(err.values, [{value: 'b', count: 3}]);
			return true;
		}
	);
});

test('видалення варіанта без голосів дозволене', function () {
	const next = parsePoll('## T\n\n[a] A\n\n-------------------\n\n(y) Так\n(n) Ні\n');

	assert.doesNotThrow(() => assertValuesPreserved(BEFORE, next, {a: 5, y: 5}));
});

test('перейменування варіанта з голосами читається як видалення', function () {
	const next = parsePoll('## T\n\n[a] A\n[b2] B\n\n-------------------\n\n(y) Так\n(n) Ні\n');

	assert.throws(
		() => assertValuesPreserved(BEFORE, next, {b: 2}),
		err => err.type === 'values_locked'
	);
});

test('зміна типу групи заборонена, поки в ній є голоси', function () {
	// та сама пара значень, але тепер radio замість checkbox
	const next = parsePoll('## T\n\n(a) A\n(b) B\n\n-------------------\n\n(y) Так\n(n) Ні\n');

	assert.throws(
		() => assertValuesPreserved(BEFORE, next, {a: 1, b: 1}),
		function (err) {
			assert.equal(err.type, 'group_type_locked');
			assert.deepEqual(err.values.map(item => item.value), ['a', 'b']);
			return true;
		}
	);
});

test('перестановка груп без зміни типів дозволена', function () {
	const next = parsePoll('## T\n\n(y) Так\n(n) Ні\n\n-------------------\n\n[a] A\n[b] B\n');

	assert.doesNotThrow(() => assertValuesPreserved(BEFORE, next, {a: 1, y: 1}));
});
