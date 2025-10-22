import {readFileSync, writeFileSync, existsSync, mkdirSync} from "node:fs";
import {resolve, join, basename} from 'node:path';
import minimist from "minimist";

const args = minimist(process.argv.slice(2));

const mdPath = args['md'];
const id = basename(mdPath, '.md');
const dir = resolve(mdPath, '..', 'img', id);

if (!existsSync(dir)) {
	mkdirSync(dir, {recursive: true});
}

let md = readFileSync(mdPath, 'utf8');
const images = new Map();

md = md.replace(/^\[(\w+)]: <data:image\/(\w+);base64,(.+)$/gm, function (_, key, ext, base64) {
	const file = key + '.' + ext;

	writeFileSync(resolve(dir, file), Buffer.from(base64, "base64"));

	images.set(key, join('img', id, file));

	return '';
});

md = md.replace(/!\[]\[(\w+)]/g, function (str, key) {
	if (!images.has(key)) return str;

	return `![${key}](${images.get(key)})`;
});

writeFileSync(mdPath, md);