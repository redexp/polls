export default function transform() {
	return transformInput;
}

/**
 * @param {import('hast').Root} root
 */
function transformInput(root) {
	const group = {
		id: 0,
		type: '',
		inputId: 0,
		min: 0,
		max: 0,
	};

	for (const block of root.children) {
		if (block.tagName === 'hr') {
			group.id++;
			group.type = '';
			group.inputId = 0;
			group.min = group.max = 0;
			continue;
		}

		if (block.tagName !== 'p') continue;

		const range = getMinMaxNumOfAnswers(block);

		if (range) {
			Object.assign(group, range);
		}

		const {children} = block;

		for (const item of children) {
			if (item.type !== 'text') continue;

			const match = (
				item.value.match(/^\s*(\[)([^\]"]+)\]/) ||
				item.value.match(/^\s*(\()([^\)"]+)\)/)
			);

			if (!match) continue;

			group.inputId++;

			const type = match[1];

			if (!group.type) {
				group.type = type;
			}

			if (type !== group.type) {
				throw new Error(`Mix of input types in one group`);
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

			if (group.min || group.max) {
				input.properties['data-range'] = group.min + '-' + group.max;
			}

			children.splice(children.indexOf(item), 0, input);

			item.value = item.value.replace(match[0], '');
		}

		if (group.type === '') continue;

		let label;

		for (let i = 0; i < children.length; i++) {
			const item = children[i];
			const t = item.tagName;

			if (t === 'input') {
				children[i] = label = {
					type: 'element',
					tagName: 'label',
					properties: {},
					children: [item],
				};
				continue;
			}

			if (!label) continue;

			label.children.push(item);

			children[i] = null;
		}

		block.children = children.filter(item => !!item);
	}
}

/**
 * @param {import('hast').Element | import('hast').Text} node
 * @return {{min: number, max: number} | null}
 */
function getMinMaxNumOfAnswers(node) {
	switch (node.type) {
	case 'element':
		if (!node.children) break;

		for (const child of node.children) {
			const res = getMinMaxNumOfAnswers(child);

			if (res) return res;
		}

		break;

	case 'text':
		const match = node.value.match(/від\s+(\d+)\s+до\s+(\d+)\s+варіантів/);

		if (!match) break;

		return {
			min: Number(match[1]),
			max: Number(match[2]),
		};
	}

	return null;
}