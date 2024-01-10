import {For, Show} from 'solid-js/web';
import {createMutable} from "solid-js/store";

export default function Notifications() {
	return (
		<Show when={state.list.length > 0}>
			<div class="fixed-top d-flex flex-column align-items-center p-3">
				<For each={state.list}>
					{(item) => (
						<div classList={{
							"alert alert-dismissible mb-2": true,
							"alert-success": item.type === 'success',
							"alert-danger": item.type === 'error',
						}}>
							{item.text}
							<button
								type="button"
								class="btn-close"
								onClick={() => removeNotification(item.id)}
							></button>
						</div>
					)}
				</For>
			</div>
		</Show>
	);
}

export const state = createMutable({list: []});

export function addNotification(item) {
	const id = item.id || String(Math.random());

	state.list.push({...item, id});

	setTimeout(
		() => removeNotification(id),
		item.type === 'error' ? 10000 : 5000
	);

	return id;
}

export function removeNotification(id) {
	const index = state.list.findIndex(item => item.id === id);

	if (index === -1) return;

	state.list.splice(index, 1);
}