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

		/** @type {import('hast').Element[]} */
		const children = block.children;

		for (let i = 0; i < children.length; i++) {
			const item = children[i];

			if (item.type !== 'text') continue;

			if (i > 0) {
				const prev = children[i - 1];

				if (prev.tagName !== 'br' && prev.value !== '\n') {
					continue;
				}
			}

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

			if (group.min || group.max) {
				input.properties['data-range'] = group.min + '-' + group.max;
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
				children[i] = label = {
					type: 'element',
					tagName: 'label',
					properties: {},
					children: [item],
				};

				if (item.properties?.value?.endsWith('-інше')) {
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
		const fromTo = node.value.match(/від\s+(\d+)\s+до\s+(\d+)\s+варіантів/);

		if (fromTo) {
			return {
				min: Number(fromTo[1]),
				max: Number(fromTo[2]),
			};
		}

		const max = node.value.match(/Оберіть\s+(\d+)/);

		if (max) {
			return {
				min: 1,
				max: Number(max[1]),
			};
		}

		break;
	}

	return null;
}