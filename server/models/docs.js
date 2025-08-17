import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {google} from 'googleapis';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {GOOGLE_SERVICE_ACCOUNT} from '../keys/index.js';
import {DOCS, IS_DEV} from '../config/index.js';

const auth = new google.auth.GoogleAuth({
	keyFile: GOOGLE_SERVICE_ACCOUNT,
	scopes: [
		'https://www.googleapis.com/auth/drive.readonly',
		'https://www.googleapis.com/auth/documents.readonly',
	],
});

const parser = (
	unified()
	.use(remarkParse)
	.use(() => rmImageReference)
	.use(remarkRehype)
	.use(() => transformInput)
	.use(rehypeStringify)
);

/**
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getAllFiles() {
	return listFilesInFolder(DOCS.folder_id);
}

export async function getFileMD(fileId) {
	const drive = getDrive();

	const res = await drive.files.export(
		{
			fileId,
			mimeType: 'text/markdown',
		},
		{responseType: 'text'}
	);

	return res.data;
}

/**
 * @param {import('remark-parse/lib').Root} root
 */
export function rmImageReference(root) {
	for (const block of root.children) {
		if (block.type !== 'paragraph' || block.children.every(item => item.type !== 'imageReference')) continue;

		block.children = block.children.filter(item => item.type !== 'imageReference');
	}
}



/**
 * @param {string} md
 * @returns {Promise<import('unified/lib').VFileWithOutput>}
 */
export function mdToHtml(md) {
	return parser.process(md);
}

/**
 * @param {string} name
 * @param {Array<string>} list
 * @returns {Promise<string>}
 */
export async function template(name, list) {
	if (name !== 'index') {
		name += '/index';
	}

	const tpl = await readFile(resolve(import.meta.dirname, '..', '..', IS_DEV ? 'dist' : 'public', 'templates', name + '.html'), 'utf8');

	return tpl.replace(/(<\w+ id="template"[^>]*>)(<\/\w+>)/, function (x, start, end) {
		start = start.replace(' id="template"', '');

		return list.map(html => start + html + end).join('\n');
	});
}

function getDrive() {
	return google.drive({version: 'v3', auth});
}

async function listFilesInFolder(folderId) {
	const drive = getDrive();

	const res = await drive.files.list({
		q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
		fields: 'files(id, name)',
	});

	return res.data.files;
}