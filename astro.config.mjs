import {defineConfig, envField} from 'astro/config';
import remarkBreaks from 'remark-breaks';
import {SERVER} from './server/config';
import transform from './src/lib/transform.js';

export default defineConfig({
	site: SERVER.url,
	env: {
		schema: {
			TITLE: envField.string({context: 'client', access: 'public'}),
			PUBLIC_MAP_TOKEN: envField.string({context: 'client', access: 'public'}),
			MAP_CENTER: envField.string({context: 'client', access: 'public'}),
		}
	},
	markdown: {
		remarkPlugins: [remarkBreaks],
		rehypePlugins: [[transform, {}]],
	},
	devToolbar: {
		enabled: false,
	},
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