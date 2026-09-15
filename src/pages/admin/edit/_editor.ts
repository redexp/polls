/**
 * Візуальний редактор на Tiptap для полів конструктора. Вантажиться динамічно —
 * лише коли перемикач увімкнено, тому цей модуль не імпортується статично.
 *
 * Джерело правди лишається markdown: редактор читає його з textarea і після
 * кожної зміни пише назад. Рядки варіантів `[val] Підпис` — звичайний текст:
 * серіалізатор екранує дужки, а сервер знімає екранування сам. Один власний
 * вузол — `pollImage`, посилальна картинка `![Картинка N][id]`: атомарний чип з
 * хрестиком, текст усередині не редагується.
 */
import {Editor, Node} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';

export type ImageItem = {alt: string, id: string};

export type EditorParams = {
	/** textarea, замість якої стає редактор; її вміст — початковий markdown */
	area: HTMLTextAreaElement,
	/** після кожної зміни — новий markdown */
	onUpdate: (markdown: string) => void,
	/** файли, кинуті або вставлені в редактор; повертає токени для вставки */
	onImageFiles: (files: File[]) => ImageItem[],
	/** кнопка «Картинка» на панелі; без колбеку кнопки немає */
	onImageButton?: () => void,
};

export type PollEditor = {
	/** обгортка з панеллю і самим редактором; стоїть перед textarea */
	element: HTMLElement,
	getMarkdown(): string,
	/** замінити вміст без події onUpdate — для змін, що прийшли з textarea */
	setMarkdown(markdown: string): void,
	insertImages(items: ImageItem[], pos?: number): void,
	focus(): void,
	destroy(): void,
};

/**
 * Перенос рядка. Власна копія стандартного hardBreak з однією відмінністю:
 * у markdown він пишеться як звичайний `\n`, а не як два пробіли — одинарний
 * перенос у файлі вже є <br> завдяки remark-breaks, а «  \n» після рядка
 * варіанта потрапив би в його підпис.
 */
const LineBreak = Node.create({
	name: 'hardBreak',
	inline: true,
	group: 'inline',
	selectable: false,
	linebreakReplacement: true,

	parseHTML() {
		return [{tag: 'br'}];
	},

	renderHTML() {
		return ['br'];
	},

	renderText() {
		return '\n';
	},

	markdownTokenName: 'br',

	parseMarkdown() {
		return {type: 'hardBreak'};
	},

	renderMarkdown() {
		return '\n';
	},

	addKeyboardShortcuts() {
		const insert = () => this.editor.commands.insertContent({type: this.name});

		return {
			'Shift-Enter': insert,
			'Mod-Enter': insert,
		};
	},
});
/** посилальна `![alt][id]` або інлайнова `![alt](src)` картинка */
const IMAGE_RE = /^!\[([^\]]*)\](?:\[([^\]\s]+)\]|\(([^)\s]+)\))/;

/**
 * Картинка в тексті. Атомарний і нередагований: показує підпис і хрестик, а в
 * markdown повертається рівно тим токеном, з якого прийшла. Інлайнова форма
 * `![alt](src)`, написана руками, теж проходить без втрат.
 */
const PollImage = Node.create({
	name: 'pollImage',
	inline: true,
	group: 'inline',
	atom: true,
	selectable: true,
	draggable: true,

	addAttributes() {
		return {
			alt: {default: ''},
			id: {default: ''},
			src: {default: ''},
		};
	},

	parseHTML() {
		return [{
			tag: 'span[data-poll-image]',
			getAttrs: (el) => ({
				alt: (el as HTMLElement).getAttribute('data-alt') || '',
				id: (el as HTMLElement).getAttribute('data-id') || '',
				src: (el as HTMLElement).getAttribute('data-src') || '',
			}),
		}];
	},

	renderHTML({node}) {
		return ['span', {
			'data-poll-image': '',
			'data-alt': node.attrs.alt,
			'data-id': node.attrs.id,
			'data-src': node.attrs.src,
			class: 'poll-image-chip',
		}, node.attrs.alt || 'Картинка'];
	},

	markdownTokenName: 'pollImage',

	markdownTokenizer: {
		name: 'pollImage',
		level: 'inline',
		start: (src: string) => src.indexOf('!['),
		tokenize(src: string) {
			const match = src.match(IMAGE_RE);

			if (!match) return;

			return {
				type: 'pollImage',
				raw: match[0],
				alt: match[1],
				id: match[2] || '',
				src: match[3] || '',
			};
		},
	},

	parseMarkdown(token, helpers) {
		return helpers.createNode('pollImage', {
			alt: String(token.alt || ''),
			id: String(token.id || ''),
			src: String(token.src || ''),
		});
	},

	renderMarkdown(node) {
		const {alt = '', id = '', src = ''} = node.attrs || {};

		return id ? `![${alt}][${id}]` : `![${alt}](${src})`;
	},

	addNodeView() {
		return ({node, getPos, editor}) => {
			const dom = document.createElement('span');

			dom.className = 'poll-image-chip';
			dom.contentEditable = 'false';
			dom.title = node.attrs.id ? 'Мініатюра — під полем' : node.attrs.src;

			const label = document.createElement('span');

			label.className = 'label';
			label.innerText = node.attrs.alt || node.attrs.src || 'Картинка';

			const remove = document.createElement('button');

			remove.type = 'button';
			remove.className = 'remove';
			remove.title = 'Видалити картинку';
			remove.setAttribute('aria-label', 'Видалити картинку ' + label.innerText);
			remove.innerText = '×';

			remove.onmousedown = (e) => e.preventDefault(); // не забирати фокус у редактора

			remove.onclick = function () {
				const pos = getPos();

				if (typeof pos !== 'number') return;

				// картинка була єдиним вмістом абзацу — прибираємо і абзац, інакше
				// в тексті лишався б порожній рядок на її місці
				const $pos = editor.state.doc.resolve(pos);
				const alone = $pos.parent.type.name === 'paragraph' && $pos.parent.childCount === 1;

				const range = (
					alone ?
						{from: $pos.before(), to: $pos.after()} :
						{from: pos, to: pos + node.nodeSize}
				);

				editor.chain().focus().deleteRange(range).run();
			};

			dom.append(label, remove);

			return {dom};
		};
	},
});

type ToolbarItem = {cmd: string, html: string, title: string, level?: number};

/**
 * Панель — кілька груп. Заголовки лише h3 і h4: h1 на сайті — назва сайту,
 * h2 — заголовок опитування.
 */
const TOOLBAR: ToolbarItem[][] = [
	[
		{cmd: 'heading', level: 3, html: 'H3', title: 'Заголовок 3'},
		{cmd: 'heading', level: 4, html: 'H4', title: 'Заголовок 4'},
	],
	[
		{cmd: 'bold', html: '<strong>Ж</strong>', title: 'Жирний (Ctrl+B)'},
		{cmd: 'italic', html: '<em>К</em>', title: 'Курсив (Ctrl+I)'},
	],
	[
		{cmd: 'orderedList', html: '1.&nbsp;—', title: 'Нумерований список'},
		{cmd: 'bulletList', html: '•&nbsp;—', title: 'Список'},
	],
];

/** рівні заголовків, які редактор узагалі приймає */
const HEADING_LEVELS = [3, 4];

export function createEditor(params: EditorParams): PollEditor {
	const {area, onUpdate, onImageFiles, onImageButton} = params;

	const element = document.createElement('div');

	element.className = 'visual-editor';

	const toolbar = document.createElement('div');

	toolbar.className = 'editor-toolbar';
	toolbar.setAttribute('role', 'toolbar');

	const buttons = new Map<HTMLButtonElement, ToolbarItem>();

	for (const group of TOOLBAR) {
		const wrap = document.createElement('div');

		wrap.className = 'btn-group btn-group-sm';

		for (const item of group) {
			const btn = document.createElement('button');

			btn.type = 'button';
			btn.className = 'btn btn-outline-secondary';
			btn.title = item.title;
			btn.innerHTML = item.html;
			// mousedown замість click забирав би фокус у редактора і зняв виділення
			btn.onmousedown = (e) => e.preventDefault();

			buttons.set(btn, item);
			wrap.appendChild(btn);
		}

		toolbar.appendChild(wrap);
	}

	if (onImageButton) {
		const wrap = document.createElement('div');
		const btn = document.createElement('button');

		wrap.className = 'btn-group btn-group-sm';

		btn.type = 'button';
		btn.className = 'btn btn-outline-secondary';
		btn.innerText = 'Додати картинку';
		btn.onmousedown = (e) => e.preventDefault();
		btn.onclick = () => onImageButton();

		wrap.appendChild(btn);
		toolbar.appendChild(wrap);
	}

	const mount = document.createElement('div');

	mount.className = 'editor-body';

	element.append(toolbar, mount);
	area.before(element);

	const editor = new Editor({
		element: mount,
		content: area.value,
		contentType: 'markdown',
		extensions: [
			StarterKit.configure({
				// набір свідомо малий: bold, italic, списки, заголовки 3–4.
				// Посилання лишаються без кнопки — інакше url із тексту губився б
				heading: {levels: HEADING_LEVELS},
				hardBreak: false,
				blockquote: false,
				code: false,
				codeBlock: false,
				horizontalRule: false,
				strike: false,
				underline: false,
			}),
			LineBreak,
			PollImage,
			Markdown.configure({
				// і читається так само: перенос рядка — це hardBreak
				markedOptions: {breaks: true},
			}),
		],
		editorProps: {
			handleDrop(view, event) {
				const files = imageFiles(event.dataTransfer?.files);

				if (files.length === 0) return false;

				event.preventDefault();

				const coords = view.posAtCoords({left: event.clientX, top: event.clientY});

				api.insertImages(onImageFiles(files), coords?.pos);

				return true;
			},
			handlePaste(_view, event) {
				const files = imageFiles(event.clipboardData?.files);

				if (files.length === 0) return false;

				event.preventDefault();
				api.insertImages(onImageFiles(files));

				return true;
			},
		},
		onUpdate() {
			onUpdate(api.getMarkdown());
		},
		onTransaction: updateToolbar,
	});

	for (const [btn, item] of buttons) {
		btn.onclick = function () {
			const chain = editor.chain().focus();

			if (item.cmd === 'heading') chain.toggleHeading({level: item.level as 3|4}).run();
			else if (item.cmd === 'bold') chain.toggleBold().run();
			else if (item.cmd === 'italic') chain.toggleItalic().run();
			else if (item.cmd === 'bulletList') chain.toggleBulletList().run();
			else if (item.cmd === 'orderedList') chain.toggleOrderedList().run();
		};
	}

	function updateToolbar() {
		for (const [btn, item] of buttons) {
			const active = (
				item.level ?
					editor.isActive(item.cmd, {level: item.level}) :
					editor.isActive(item.cmd)
			);

			btn.classList.toggle('active', active);
			btn.setAttribute('aria-pressed', String(active));
		}
	}

	const api: PollEditor = {
		element,

		/**
		 * Рядки варіантів `[a] Підпис` серіалізатор віддає екранованими —
		 * `\[a\] Підпис`. Сервер такі рядки і сам зводить до канонічного
		 * вигляду, але в textarea після вимкнення редактора людина має бачити
		 * звичайні дужки, тому екранування на початку рядка знімається тут,
		 * тим самим правилом, що й на сервері.
		 */
		getMarkdown() {
			return (
				editor.getMarkdown()
				.replace(/^([ \t]*)\\\[([^\]\n]*)\\\]/gm, '$1[$2]')
				// порожній абзац дає зайві порожні рядки; у файлі вони нічого
				// не означають, а при наступному читанні стали б &nbsp;
				.replace(/\n{3,}/g, '\n\n')
				.trim()
			);
		},

		setMarkdown(markdown) {
			editor.commands.setContent(markdown, {contentType: 'markdown', emitUpdate: false});
		},

		insertImages(items, pos) {
			if (items.length === 0) return;

			const nodes = items.map(item => ({type: 'pollImage', attrs: {alt: item.alt, id: item.id}}));
			const chain = editor.chain().focus();

			if (typeof pos === 'number') {
				chain.insertContentAt(pos, nodes).run();
			}
			else {
				chain.insertContent(nodes).run();
			}
		},

		focus() {
			editor.commands.focus();
		},

		destroy() {
			editor.destroy();
			element.remove();
		},
	};

	updateToolbar();

	return api;
}

function imageFiles(list?: FileList|null): File[] {
	return Array.from(list || []).filter(file => file.type.startsWith('image/'));
}
