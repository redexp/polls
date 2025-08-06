import {existsSync, readdirSync, readFileSync, writeFileSync} from 'fs';
import {resolve} from 'path';
import {remark} from 'remark';
import remarkMdx from 'remark-mdx';

const parser = remark().use(remarkMdx);
const meta = new Map();

const answerRule = /^(check|dot)$/;

const POLLS_DIR = resolve(import.meta.dirname, '..', 'src', 'polls');
const OUTPUT_FILE = resolve(import.meta.dirname, '..', 'server', 'polls_meta.json');

for (const type of ['active', 'past']) {
	const DIR = resolve(POLLS_DIR, type === 'active' ? '.' : type);
	const files = existsSync(DIR) ? readdirSync(DIR) : [];
	const active = type === 'active';

	for (const file of files) {
		if (!file.endsWith('.mdx')) continue;

		const name = file.replace(/\.mdx$/i, '');

		if (meta.has(name)) {
			throw new Error(`Duplicate ${name}`);
		}

		const info = {file, active, values: []};

		const tree = parser.parse(readFileSync(resolve(DIR, file)));

		let value = 0;

		for (const item of tree.children) {
			const first = item.children[0];

			if (
				item.type !== 'paragraph' ||
				!first ||
				first.type !== 'mdxJsxTextElement' ||
				!answerRule.test(first.name)
			) {
				continue;
			}

			const answer_type = first.name;

			if (info.answer_type && info.answer_type !== answer_type) {
				throw new Error(`${type}/${file} has mixed answer types`);
			}

			info.answer_type = answer_type;

			const valueAttr = first.attributes?.find(a => a.name === 'value');

			if (valueAttr) {
				if (info.values.includes(valueAttr.value)) {
					throw new Error(`${type}/${file} has duplicated answers values "${valueAttr.value}"`);
				}

				info.values.push(valueAttr.value);
			}
			else {
				info.values.push(String(++value));
			}
		}

		meta.set(name, info);
	}
}

writeFileSync(
	OUTPUT_FILE,
	JSON.stringify(Object.fromEntries(meta))
);