import {defineConfig, envField} from 'astro/config';
import solid from '@astrojs/solid-js';
import remarkBreaks from 'remark-breaks';
import {SERVER} from './server/config';
import transform from './src/lib/transform.js';

export default defineConfig({
	site: SERVER.url,
	env: {
		schema: {
			TITLE: envField.string({context: 'client', access: 'public'})
		}
	},
	markdown: {
		remarkPlugins: [remarkBreaks],
		rehypePlugins: [[transform, {}]],
	},
	integrations: [
		solid({
			include: ['**/components/*.jsx']
		}),
	],
	vite: {
		server: {
			proxy: {
				'/api': {
					target: 'http://localhost:' + SERVER.port,
					changeOrigin: true,
				}
			}
		}
	},
});