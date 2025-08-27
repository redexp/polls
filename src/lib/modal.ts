import {byId, loading} from './dom.ts';

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
}

export function showInfoModal(text: string, params?: ModalParams): Modal {
	const modal = showModal('info-modal', {
		size: 'sm',
		...params,
	});

	modal.loadingBtn = modal.node.querySelector<HTMLButtonElement>('.btn')!;

	const body = modal.node.querySelector<HTMLDivElement>('.modal-body')!;
	body.innerText = text;

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
};