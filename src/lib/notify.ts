import {byId} from './dom.ts';

const root = byId<HTMLDivElement>('notifications');
const tpl = root.firstElementChild!.cloneNode(true);

for (let i = root.childNodes.length - 1; i >= 0; i--) {
	root.childNodes.item(i).remove();
}

root.style.display = '';

export function success(text: string) {
	add({
		type: 'success',
		text,
	});
}

export function error(text: string) {
	add({
		type: 'error',
		text,
	});
}

function add(item: Noti) {
	const node = tpl.cloneNode(true) as HTMLDivElement;
	node.classList.toggle('alert-success', item.type === 'success');
	node.classList.toggle('alert-danger', item.type === 'error');
	node.querySelector('span')!.innerText = item.text;
	node.querySelector<HTMLButtonElement>('.btn-close')!.onclick = () => node.remove();
	root.appendChild(node);

	const timeout = item.timeout || (
		item.type === 'success' ?
			5_000 :
			10_000
	);

	setTimeout(() => {
		node.remove();
	}, timeout)
}

export type Noti = {
	type: 'success' | 'error',
	text: string,
	timeout?: number,
};