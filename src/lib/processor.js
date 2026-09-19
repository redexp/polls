import {satteri} from '@astrojs/markdown-satteri';
import breaks from './breaks.js';
import transform from './transform.js';

/**
 * Один процесор для збірки і для прев'ю в адмінці. Якби прев'ю збиралося
 * власним ланцюжком, воно б рано чи пізно почало брехати.
 */
export const processor = satteri({
	mdastPlugins: [breaks],
	hastPlugins: [transform],
});

