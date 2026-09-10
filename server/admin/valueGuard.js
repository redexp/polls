import {parsePoll} from '../models/pollFile.js';

/**
 * Додати варіант можна — старі голоси лишаються валідними. Видалити,
 * перейменувати або перенести в групу іншого типу — ні: це знищує наявні
 * відповіді, а перерахувати їх назад неможливо.
 *
 * @param {string} prevMd вміст файлу до змін
 * @param {{values: string[], groups: Array<{type: string, values: string[]}>}} next розібраний новий вміст
 * @param {Object<string, number>} valueCounts кількість голосів за кожне значення
 * @param {string} [file] для повідомлень про помилки
 */
export function assertValuesPreserved(prevMd, next, valueCounts, file) {
	const before = parsePoll(prevMd, file);
	const beforeTypes = typesByValue(before.groups);
	const afterTypes = typesByValue(next.groups);

	const removed = [];
	const retyped = [];

	for (const value of before.values) {
		const count = valueCounts[value] || 0;

		if (count === 0) continue;

		if (!next.values.includes(value)) {
			removed.push({value, count});
			continue;
		}

		if (beforeTypes[value] !== afterTypes[value]) {
			retyped.push({value, count});
		}
	}

	if (removed.length > 0) {
		throw {type: 'values_locked', values: removed};
	}

	if (retyped.length > 0) {
		throw {type: 'group_type_locked', values: retyped};
	}
}

/**
 * @param {Array<{type: string, values: string[]}>} groups
 * @returns {Object<string, string>}
 */
export function typesByValue(groups) {
	const types = {};

	for (const group of groups) {
		for (const value of group.values) {
			types[value] = group.type;
		}
	}

	return types;
}
