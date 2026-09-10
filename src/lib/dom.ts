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

export function setLinkParams(selector: string, params: {[name: string]: any}) {
	const link = qs<HTMLAnchorElement>(selector);
	const url = new URL(link.href);
	for (const [name, value] of Object.entries(params)) {
		url.searchParams.set(name, value);
	}
	link.href = url.toString();
}

export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	}
	catch {
		// clipboard API недоступний поза https — падаємо у ручний спосіб нижче
	}

	const area = document.createElement('textarea');

	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';

	document.body.appendChild(area);
	area.select();

	const done = document.execCommand('copy');

	area.remove();

	return done;
}

export function clearHtml(html: string): string {
	return html.replace(/<(\w+)/, function (x, tag) {
		return (
			tag === 'strong' || tag === 'br' ?
				x :
				''
		);
	});
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