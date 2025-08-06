import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import solid from '@astrojs/solid-js';
import {SERVER} from './server/config';
import transform from './src/lib/transform.js';

export default defineConfig({
	site: 'https://polls.cherkasyurban.institute',
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
	vite: {
		server: {
			proxy: {
				'/api': {
					target: SERVER.url,
					changeOrigin: true,
				}
			}
		}
	}
});