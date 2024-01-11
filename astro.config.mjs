import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import solid from '@astrojs/solid-js';

export default defineConfig({
	site: 'https://vote.pp.ua',
	integrations: [
		solid({
			include: ['**/components/*.jsx']
		}),
		mdx({
			remarkPlugins: [
				transform
			]
		}),
	],
});

function transform() {
	const mdxRule = /\.mdx$/i;
	const votesDirRule = /\/votes\/(active|past)$/;
	const answerRule = /^(check|dot)$/;

	return (tree, file) => {
		const {basename, dirname} = file;

		if (!mdxRule.test(basename) || !votesDirRule.test(dirname)) return tree;

		/** @type {Array<{type: string, [prop: string]: any}>} */
		const children = tree.children;

		const name = basename.replace(mdxRule, '');

		const header = children.find(item => item.type === 'heading');

		if (header) {
			debugger;

			children[children.indexOf(header)] = createTag('h' + header.depth, {
				id: name,
				class: 'mb-3'
			}, [createTag('a', {class: 'header-link', href: `/votes/${name}`}), ...header.children]);
		}

		children.unshift(createImportComponent('Answer'));
		children.unshift(createImportComponent('Summary'));

		let cur;

		for (let i = 0; i < children.length; i++) {
			const item = children[i];

			if (
				item.type === 'paragraph' &&
				item.children[0]?.type === 'mdxJsxTextElement' &&
				answerRule.test(item.children[0].name)
			) {
				cur = createAnswerTag(item.children[0].name, name);
				children[i] = cur;
				item.children.splice(0, 1);
				cur.children.push(item);
			}
			else if (cur && item.type === 'paragraph') {
				cur.children.push(item);
				children.splice(i, 1);
				i--;
			}
			else if (cur) {
				cur = null;
			}
		}

		let value = 0;
		let lastAnswer;

		for (const item of children) {
			if (item.type !== 'mdxJsxFlowElement' || item.name !== 'Answer') continue;

			lastAnswer = item;

			if (!item.attributes.some(a => a.name === 'name')) {
				item.attributes.push({
					type: "mdxJsxAttribute",
					name: "name",
					value: name,
				});
			}

			if (!item.attributes.some(a => a.name === 'value')) {
				value++;

				item.attributes.push({
					type: "mdxJsxAttribute",
					name: "value",
					value: String(value),
				});
			}
		}

		if (lastAnswer) {
			children.splice(
				children.indexOf(lastAnswer) + 1,
				0,
				createTag('Summary', {
					name
				})
			);
		}

		return tree;
	};
}

function createImportComponent(name) {
	const path = `@components/${name}.astro`;

	return {
		"type": "mdxjsEsm",
		"value": `import ${name} from '${path}';`,
		"data": {
			"estree": {
				"type": "Program",
				"sourceType": "module",
				"comments": [],
				"body": [
					{
						"type": "ImportDeclaration",
						"specifiers": [
							{
								"type": "ImportDefaultSpecifier",
								"local": {
									"type": "Identifier",
									"name": name,
								},
							}
						],
						"source": {
							"type": "Literal",
							"value": path,
							"raw": `'${path}'`,
						},
					}
				],
			}
		}
	};
}

function createAnswerTag(type, name) {
	return createTag('Answer', {type, name});
}

function createTag(name, attributes = {}, children = []) {
	return {
		"type": "mdxJsxFlowElement",
		"name": name,
		"attributes": Object.keys(attributes).map(name => ({
			"type": "mdxJsxAttribute",
			"name": name,
			"value": attributes[name],
		})),
		"children": children,
		"data": {
			"_mdxExplicitJsx": true
		}
	};
}