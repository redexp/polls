import {byId, clearHtml, loading} from './dom.ts';

/** слухачі Esc по id модалки, щоб знімати їх при закритті */
const escapeHandlers = new Map<string, (e: KeyboardEvent) => void>();

export function showModal(id: string, params?: ModalParams): Modal {
	const root = byId<HTMLDivElement>(id);

	const modal = {
		node: root,
		close() {
			hideModal(id);

			if (modal.onClose) {
				modal.onClose();
			}
		},
		loading(p) {
			const btn = modal.loadingBtn;

			if (!btn) return;

			loading(btn, true);

			p
			.catch(() => null)
			.then(() => {
				loading(btn, false);
			});
		},
	} as Modal;

	if (params?.size) {
		const dialog = root.querySelector('.modal-dialog')!;
		dialog.classList.toggle('modal-sm', params.size === 'sm');
		dialog.classList.toggle('modal-lg', params.size === 'lg');
	}

	root.style.display = 'block';

	requestAnimationFrame(() => {
		root.classList.add('show');
	});

	if (root.dataset.close !== 'false') {
		root.onclick = function (e) {
			if (e.target === root) {
				modal.close();
			}
		};

		// Esc закриває так само, як клік поза вікном. Слухач знімається при
		// закритті, інакше вони накопичувались би з кожним відкриттям
		const onKeyDown = function (e: KeyboardEvent) {
			if (e.key !== 'Escape') return;

			e.preventDefault();
			modal.close();
		};

		document.addEventListener('keydown', onKeyDown);

		escapeHandlers.set(id, onKeyDown);
	}

	for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-close]')) {
		if (btn.dataset.close === 'false') continue;

		btn.onclick = modal.close;
	}

	return modal;
}

export function hideModal(id: string) {
	const root = byId(id);

	root.style.display = '';
	root.classList.remove('show');

	const onKeyDown = escapeHandlers.get(id);

	if (onKeyDown) {
		document.removeEventListener('keydown', onKeyDown);
		escapeHandlers.delete(id);
	}
}

export function showInfoModal(text: string, params?: ModalParams): Modal {
	const modal = showModal('info-modal', {
		size: 'sm',
		...params,
	});

	modal.loadingBtn = modal.node.querySelector<HTMLButtonElement>('.btn')!;

	const body = modal.node.querySelector<HTMLDivElement>('.modal-body')!;

	if (params?.html) {
		body.innerHTML = clearHtml(text);
	}
	else {
		body.innerText = text;
	}

	return modal;
}

/**
 * Показує пояснення, розмітка якого вже лежить у сторінці — зазвичай у
 * <template>. Санітайзер тут не потрібен і не застосовується: вміст приходить
 * не із запиту, а з самої сторінки. Ніколи не передавайте сюди вузол, зібраний
 * з даних користувача.
 */
export function showHelpModal(source: HTMLElement, params?: ModalParams): Modal {
	const modal = showModal('info-modal', {
		size: 'default',
		...params,
	});

	modal.loadingBtn = modal.node.querySelector<HTMLButtonElement>('.btn')!;

	const body = modal.node.querySelector<HTMLDivElement>('.modal-body')!;

	body.replaceChildren(
		source instanceof HTMLTemplateElement ?
			source.content.cloneNode(true) :
			source.cloneNode(true)
	);

	return modal;
}

export type Modal = {
	node: HTMLDivElement,
	loadingBtn?: HTMLButtonElement,
	onClose?: () => void,
	close(): void,
	loading(state: Promise<any>): void,
};

export type ModalParams = {
	size?: 'sm'|'lg'|'default',
	html?: boolean,
};