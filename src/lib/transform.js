export default function transform() {
	return transformInput;
}

/** директива обмежень групи: {min-max}, завжди два числа */
const DIRECTIVE_RE = /^\s*\{(\d+)\s*-\s*(\d+)\}\s*$/;

/**
 * @param {import('hast').Root} root
 */
function transformInput(root) {
	const group = {
		id: 0,
		type: '',
		inputId: 0,
		min: null,
		max: null,
	};

	/** @type {Set<import('hast').Element>} */
	const dropBlocks = new Set();

	for (const block of root.children) {
		if (block.tagName === 'hr') {
			group.id++;
			group.type = '';
			group.inputId = 0;
			group.min = group.max = null;
			continue;
		}

		if (block.tagName !== 'p') continue;

		/** @type {import('hast').Element[]} */
		const children = block.children;

		takeRangeDirective(children, group);

		if (children.length === 0) {
			// у абзаці була лише директива
			dropBlocks.add(block);
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

			item.value = item.value.replace(match[0], '');
			children.splice(i, 0, input);
			i++;
		}

		if (group.type === '') continue;

		let label;

		for (let i = 0; i < children.length; i++) {
			const item = children[i];
			const t = item.tagName;

			if (t === 'input') {
				const needsText = withText.has(item);

				children[i] = label = {
					type: 'element',
					tagName: 'label',
					properties: {},
					children: [item],
				};

				if (needsText) {
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

			children[i] = null;
		}

		block.children = children.filter(item => !!item);
	}

	if (dropBlocks.size > 0) {
		root.children = root.children.filter(block => !dropBlocks.has(block));
	}
}

/**
 * Знаходить рядок-директиву {min-max} серед дітей абзацу, застосовує до групи і
 * прибирає з дерева разом із наступним переносом рядка.
 *
 * @param {import('hast').Element[]} children
 * @param {{min: number|null, max: number|null}} group
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
		const removeCount = next && next.tagName === 'br' ? 2 : 1;

		children.splice(i, removeCount);

		return;
	}
}

/**
 * @param {import('hast').Element[]} children
 * @param {number} i
 * @returns {boolean}
 */
function isLineStart(children, i) {
	if (i === 0) return true;

	const prev = children[i - 1];

	return prev.tagName === 'br' || prev.value === '\n';
}
