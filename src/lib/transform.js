/** директива обмежень групи: {min-max}, завжди два числа */
const DIRECTIVE_RE = /^\s*\{(\d+)\s*-\s*(\d+)\}\s*$/;

/**
 * Hast-плагін Sätteri: рядки `[v] текст` / `(v) текст` стають інпутами з
 * підписами. Стан групи тягнеться через абзаци і скидається на `<hr>`, тому
 * обхід іде хуком `before` по всьому корені, а не візитором окремих `<p>`.
 *
 * Вузли дерева незмінні: абзац перебирається в копії дітей і підміняється
 * цілком через `ctx.replaceNode`.
 *
 * @type {import('satteri').HastPluginDefinition}
 */
export const transform = {
	name: 'poll-inputs',
	before(root, ctx) {
		const group = {
			id: 0,
			type: '',
			inputId: 0,
			min: null,
			max: null,
		};

		for (const block of root.children) {
			if (block.type !== 'element') continue;

			if (block.tagName === 'hr') {
				group.id++;
				group.type = '';
				group.inputId = 0;
				group.min = group.max = null;
				continue;
			}

			if (block.tagName !== 'p') continue;

			/** @type {import('hast').ElementContent[]} */
			const children = [...block.children];

			let changed = takeRangeDirective(children, group);

			if (children.length === 0) {
				// у абзаці була лише директива
				ctx.removeNode(block);
				continue;
			}

			/** @type {Set<import('hast').Element>} */
			const withText = new Set();

			for (let i = 0; i < children.length; i++) {
				const item = children[i];

				if (item.type !== 'text') continue;

				if (!isLineStart(children, i)) continue;

				const match = (
					item.value.match(/^\s*(\[)([^\]"]+)\](\+?)/) ||
					item.value.match(/^\s*(\()([^\)"]+)\)(\+?)/)
				);

				if (!match) continue;

				group.inputId++;

				const type = match[1];

				if (!group.type) {
					group.type = type;
				}

				if (type !== group.type) {
					throw new Error(`Mix of input types in one group: ${JSON.stringify(match[0])}`);
				}

				const name = (
					type === '[' ?
						group.id + '-' + group.inputId :
						group.id
				);

				/** @type {import('hast').Element} */
				const input = {
					type: 'element',
					tagName: 'input',
					properties: {
						type: type === '[' ? 'checkbox' : 'radio',
						name,
						value: match[2],
						class: 'form-check-input',
						'data-group': group.id,
					},
					children: [],
				};

				// дефолти обчислює клієнт: він знає кількість інпутів у групі,
				// а тут вона ще невідома — група може тривати кілька абзаців
				if (group.min !== null) {
					input.properties['data-min'] = group.min;
					input.properties['data-max'] = group.max;
				}

				if (match[3] === '+') {
					withText.add(input);
				}

				children.splice(i, 1, input, {
					type: 'text',
					value: item.value.replace(match[0], ''),
				});
				i++;

				changed = true;
			}

			if (!changed) continue;

			if (group.type !== '') {
				wrapInLabels(children, withText);
			}

			ctx.replaceNode(block, {
				type: 'element',
				tagName: 'p',
				properties: {...block.properties},
				children,
			});
		}
	},
};

export default transform;

/**
 * Кожен інпут стає `<label>`, який поглинає все після себе до наступного
 * інпута. Для інпутів з `+` одразу за label іде textarea.
 *
 * @param {import('hast').ElementContent[]} children змінюється на місці
 * @param {Set<import('hast').Element>} withText
 */
function wrapInLabels(children, withText) {
	/** @type {import('hast').Element | undefined} */
	let label;

	for (let i = 0; i < children.length; i++) {
		const item = children[i];

		if (item.type === 'element' && item.tagName === 'input') {
			const needsText = withText.has(item);

			children[i] = label = {
				type: 'element',
				tagName: 'label',
				properties: {},
				children: [item],
			};

			if (needsText) {
				/** @type {import('hast').Element} */
				const textarea = {
					type: 'element',
					tagName: 'textarea',
					properties: {
						class: 'form-control',
						name: item.properties.value,
						rows: 3,
					},
					children: [],
				};

				children.splice(i + 1, 0, textarea);

				i++;
			}

			continue;
		}

		if (!label) continue;

		label.children.push(item);

		children.splice(i, 1);
		i--;
	}
}

/**
 * Знаходить рядок-директиву {min-max} серед дітей абзацу, застосовує до групи і
 * прибирає з масиву разом із наступним переносом рядка.
 *
 * @param {import('hast').ElementContent[]} children
 * @param {{min: number|null, max: number|null}} group
 * @returns {boolean} чи була директива
 */
function takeRangeDirective(children, group) {
	for (let i = 0; i < children.length; i++) {
		const item = children[i];

		if (item.type !== 'text') continue;

		if (!isLineStart(children, i)) continue;

		const match = item.value.match(DIRECTIVE_RE);

		if (!match) continue;

		if (group.min !== null) {
			throw new Error(`Duplicate range directive in one group: ${JSON.stringify(item.value.trim())}`);
		}

		group.min = Number(match[1]);
		group.max = Number(match[2]);

		const next = children[i + 1];
		const removeCount = next && next.type === 'element' && next.tagName === 'br' ? 2 : 1;

		children.splice(i, removeCount);

		return true;
	}

	return false;
}

/**
 * @param {import('hast').ElementContent[]} children
 * @param {number} i
 * @returns {boolean}
 */
function isLineStart(children, i) {
	if (i === 0) return true;

	const prev = children[i - 1];

	return (
		(prev.type === 'element' && prev.tagName === 'br') ||
		(prev.type === 'text' && prev.value === '\n')
	);
}
