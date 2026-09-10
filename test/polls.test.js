import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import moment from 'moment';
import {polls, isValidPollValues, isPublicPoll} from '../server/models/polls.js';

/**
 * @param {Partial<import('../server/models/polls.d.ts').PollMeta>} data
 */
function setPoll(data) {
	polls.set('t', {
		id: 't',
		expire: null,
		public: false,
		values: [],
		groups: [],
		...data,
	});
}

beforeEach(function () {
	polls.clear();
});

test('обмеження max перевіряється на сервері, а не лише в браузері', function () {
	setPoll({
		values: ['a', 'b', 'c'],
		groups: [{type: 'checkbox', values: ['a', 'b', 'c'], min: 1, max: 2}],
	});

	assert.equal(isValidPollValues('t', ['a']), true);
	assert.equal(isValidPollValues('t', ['a', 'b']), true);
	assert.equal(isValidPollValues('t', ['a', 'b', 'c']), 'invalid_range');
});

test('обмеження min перевіряється на сервері', function () {
	setPoll({
		values: ['a', 'b', 'c'],
		groups: [{type: 'checkbox', values: ['a', 'b', 'c'], min: 2, max: 3}],
	});

	assert.equal(isValidPollValues('t', ['a']), 'invalid_range');
	assert.equal(isValidPollValues('t', ['a', 'b']), true);
});

test('група з min 0 може лишитись без відповіді', function () {
	setPoll({
		values: ['a', 'b', 'y', 'n'],
		groups: [
			{type: 'checkbox', values: ['a', 'b'], min: 1, max: 2},
			{type: 'radio', values: ['y', 'n'], min: 0, max: 1},
		],
	});

	assert.equal(isValidPollValues('t', ['a']), true);
	assert.equal(isValidPollValues('t', ['a', 'y']), true);
	assert.equal(isValidPollValues('t', ['y']), 'invalid_range', 'перша група обов’язкова');
});

test('обов’язкова група без відповіді відхиляється', function () {
	setPoll({
		values: ['a', 'b', 'y', 'n'],
		groups: [
			{type: 'checkbox', values: ['a', 'b'], min: 1, max: 2},
			{type: 'radio', values: ['y', 'n'], min: 1, max: 1},
		],
	});

	assert.equal(isValidPollValues('t', ['a']), 'invalid_range');
	assert.equal(isValidPollValues('t', ['a', 'y']), true);
});

test('radio-група приймає лише одне значення', function () {
	setPoll({
		values: ['y', 'n'],
		groups: [{type: 'radio', values: ['y', 'n'], min: 1, max: 1}],
	});

	assert.equal(isValidPollValues('t', ['y', 'n']), 'many_radio_values');
});

test('невідомі значення, невідоме опитування, прострочене опитування', function () {
	setPoll({
		values: ['a'],
		groups: [{type: 'checkbox', values: ['a'], min: 1, max: 1}],
	});

	assert.equal(isValidPollValues('t', ['x']), 'invalid_values');
	assert.equal(isValidPollValues('nope', ['a']), 'invalid_poll_id');
	assert.equal(isValidPollValues('t', []), 'empty_values');

	setPoll({
		expire: moment.utc('2000-01-01'),
		values: ['a'],
		groups: [{type: 'checkbox', values: ['a'], min: 1, max: 1}],
	});

	assert.equal(isValidPollValues('t', ['a']), 'expired');
});

test('isPublicPoll', function () {
	setPoll({public: true, values: ['a'], groups: []});

	assert.equal(isPublicPoll('t'), true);
	assert.equal(isPublicPoll('nope'), false);
});
