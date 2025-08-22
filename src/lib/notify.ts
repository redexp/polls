import {each} from './dom.ts';

const ctrl = each<Noti>('#notifications', function (item, q, node) {
	node.classList.toggle('alert-success', item.type === 'success');
	node.classList.toggle('alert-danger', item.type === 'error');
	q('span').innerText = item.text;
	q<HTMLButtonElement>('.btn-close').onclick = () => ctrl.remove(item);
});

ctrl.root.style.display = '';

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
	ctrl.add(item);

	const timeout = item.timeout || (
		item.type === 'success' ?
			5_000 :
			10_000
	);

	setTimeout(() => {
		ctrl.remove(item);
	}, timeout);
}

export type Noti = {
	type: 'success' | 'error',
	text: string,
	timeout?: number,
};