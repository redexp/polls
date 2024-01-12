import {createMemo, createResource} from "solid-js";
import {getPollStats} from './AnswerLoader.jsx';
import appState from './appState.jsx';

export default function SummaryLoader({name}) {
	const [total] = createResource(
		() => [appState.reloadStatsSignal],
		() => getTotal(name),
		{
			initialValue: 0,
		}
	);

	const title = createMemo(() => {
		const n = total() % 10;

		return (
			n === 1 ?
				'громадянин' :
			n >= 2 && n <= 4 ?
				'громадянина' :
				'громадян'
		);
	});

	return (
		<div class="alert alert-light d-lg-inline-block mt-4">
			<span class="me-2">Загалом взяли участь у опитуванні</span>
			<span class="badge rounded-pill bg-primary fs-6">{total() + ' ' + title()}</span>
		</div>
	);
}

async function getTotal(name) {
	const stats = await getPollStats(name);

	return Object.values(stats).reduce((sum, item) => sum + item.count, 0);
}