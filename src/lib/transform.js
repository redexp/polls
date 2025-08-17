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
	};

	for (const block of root.children) {
		if (block.tagName === 'hr') {
			group.id++;
			group.type = '';
			group.inputId = 0;
			continue;
		}

		if (block.tagName !== 'p') continue;

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
					class: 'form-check-input'
				},
			};

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