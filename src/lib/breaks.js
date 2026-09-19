/**
 * Одинарний перенос рядка → `<br>`, як remark-breaks. У Sätteri такої фічі
 * немає, а без неї варіанти групи злипалися б в один рядок.
 *
 * @type {import('satteri').MdastPluginDefinition}
 */
export const breaks = {
	name: 'breaks',
	text(node, ctx) {
		if (!node.value.includes('\n')) return;

		/** @type {import('mdast').PhrasingContent[]} */
		const out = [];

		node.value.split('\n').forEach(function (part, i) {
			if (i > 0) out.push({type: 'break'});
			if (part) out.push({type: 'text', value: part});
		});

		ctx.replaceNode(node, out);
	},
};

export default breaks;
