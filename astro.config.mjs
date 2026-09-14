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
			// Адмінка пише опитування в src/polls, а це база content-колекції:
			// кожне збереження інвалідувало б сторінку і перезавантажувало
			// браузер просто посеред редагування. У prod такого немає — там
			// сторінки статичні, і за файлами ніхто не слідкує.
			//
			// Ціна: у dev файл опитування, змінений руками, зʼявиться на
			// публічних сторінках після ручного оновлення браузера.
			watch: {
				// регулярка, а не glob: на windows шляхи приходять із
				// зворотними слешами і `**/src/polls/**` їх не матчить
				ignored: [/[\\/]src[\\/]polls[\\/]/],
			},
			proxy: {
				'/api': {
					target: 'http://localhost:' + SERVER.port,
					changeOrigin: true,
				},
				// картинки опитувань лежать поза public/, у dev їх віддає express
				'/img/polls': {
					target: 'http://localhost:' + SERVER.port,
					changeOrigin: true,
				},
			}
		}
	},
});
