import {defineCollection, z} from 'astro:content';
import {glob} from 'astro/loaders';

const polls = defineCollection({
	loader: glob({
		pattern: ['**/*.md'],
		base: 'src/polls',
	}),
	schema: () => z.object({
		expire: z.date().optional(),
		anonymous: z.boolean().optional(),
	}),
});

export const collections = {polls};