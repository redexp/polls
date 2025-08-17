import {byId, loading} from './dom.ts';

export function showModal(id: string): Modal {
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

	root.style.display = 'block';

	requestAnimationFrame(() => {
		root.classList.add('show');
	});

	root.onclick = function (e) {
		if (e.target === root) {
			modal.close();
		}
	};

	for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-close]')) {
		btn.onclick = modal.close;
	}

	return modal;
}

export function hideModal(id: string) {
	const root = byId(id);

	root.style.display = '';
	root.classList.remove('show');
}

export function showInfoModal(text: string): Modal {
	const modal = showModal('info-modal');
	const body = modal.node.querySelector<HTMLDivElement>('.modal-body')!;
	modal.loadingBtn = modal.node.querySelector<HTMLButtonElement>('.btn')!;

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