import {unified} from '@astrojs/markdown-remark';
import remarkBreaks from 'remark-breaks';
import transform from './transform.js';

/**
 * Один процесор для збірки і для прев'ю в адмінці. Якби прев'ю збиралося
 * власним ланцюжком, воно б рано чи пізно почало брехати.
 */
export const processor = unified({
	remarkPlugins: [remarkBreaks],
	rehypePlugins: [transform],
});

export default processor;
