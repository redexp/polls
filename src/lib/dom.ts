export function qs<T = HTMLElement>(selector: string): T {
	return document.querySelector(selector) as T;
}

export function qsAll<T = HTMLElement>(selector: string): T[] {
	return Array.from(document.querySelectorAll(selector)) as T[];
}

export function byId<T = HTMLElement>(id: string): T {
	return document.getElementById(id) as T;
}

export function hidden<T = HTMLElement>(selector: string, state: boolean): T {
	const node = qs(selector);
	node.classList.toggle('d-none', state);
	return node as T;
}

export function loading(btn: HTMLButtonElement, state: boolean) {
	btn.disabled = state;
	btn.classList.toggle('loading', state);
}

export function getValue(id: string): string {
	return byId<HTMLInputElement>(id).value;
}

export function setValue(id: string, value: string) {
	const input = byId<HTMLInputElement>(id);

	input.value = value;

	input.dispatchEvent(new Event('input', {
		bubbles: true,
		cancelable: true,
	}));
}

export function getText(id: string): string {
	return byId(id).innerText;
}