import {defineCollection} from 'astro:content';
import {z} from 'astro/zod';
import {glob} from 'astro/loaders';

const polls = defineCollection({
	loader: glob({
		pattern: ['**/*.md'],
		base: 'src/polls',
	}),
	schema: z.object({
		expire: z.date().optional(),
		public: z.boolean().optional(),
		// обмеження груп задаються директивою {min-max} у тілі опитування;
		// поле optional скасоване — воно було рівно min = 0
		draft: z.boolean().optional(),
	}),
});

export const collections = {polls};
