export function qs<T = HTMLElement>(selector: string, root?: HTMLElement): T {
	return (root || document).querySelector(selector) as T;
}

export function qsAll<T = HTMLElement>(selector: string): T[] {
	return Array.from(document.querySelectorAll(selector)) as T[];
}

export function byId<T = HTMLElement>(id: string): T {
	return document.getElementById(id) as T;
}

export function loading(btn: HTMLButtonElement, state: boolean) {
	btn.disabled = state;
	btn.classList.toggle('loading', state);
}

export function getValues(selector: string): string[] {
	return qsAll<HTMLInputElement>(selector).map(inp => inp.value);
}

export function setLinkParams(selector: string, params: {[name: string]: string}) {
	const link = qs<HTMLAnchorElement>(selector);
	const url = new URL(link.href);
	for (const [name, value] of Object.entries(params)) {
		url.searchParams.set(name, value);
	}
	link.href = url.toString();
}

export function each<T, E extends HTMLElement = HTMLElement>(selector: string, apply: (item: T, querySelector: typeof qs, tpl: E) => void, reverse?: boolean) {
	const root = qs(selector);
	const tpl = root.firstElementChild!.cloneNode(true);

	const nodes = new Map<T, E>();

	const add = function (item: T) {
		const node = tpl.cloneNode(true) as E;

		const querySelector = (s) => qs(s, node);

		apply(item, querySelector as typeof qs, node);

		nodes.set(item, node);

		if (reverse && root.firstElementChild) {
			root.insertBefore(node, root.firstElementChild);
		}
		else {
			root.appendChild(node);
		}
	};

	const remove = function (item: T) {
		nodes.get(item)?.remove();
		nodes.delete(item);
	};

	const reset = function (list: T[]) {
		for (let i = root.childNodes.length - 1; i >= 0; i--) {
			root.childNodes.item(i).remove();
		}

		for (const item of list) {
			add(item);
		}
	};

	reset([]);

	return {
		root,
		tpl,
		nodes,
		add,
		remove,
		reset,
	};
}