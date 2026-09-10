import {defineConfig, envField} from 'astro/config';
import {SERVER} from './server/config';
import {processor} from './src/lib/processor.js';

export default defineConfig({
	site: SERVER.url,
	// адмінка збирає в теку зі штампом часу і потім переставляє симлінк dist
	outDir: process.env.ASTRO_OUT_DIR || './dist',
	env: {
		schema: {
			TITLE: envField.string({context: 'client', access: 'public'}),
			PUBLIC_MAP_TOKEN: envField.string({context: 'client', access: 'public'}),
			MAP_CENTER: envField.string({context: 'client', access: 'public'}),
		}
	},
	markdown: {
		processor,
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
