import {createResource} from "solid-js";
import {getVoteStats} from './AnswerLoader.jsx';
import appState from './appState.jsx';

export default function SummaryLoader({name}) {
	const [total] = createResource(
		() => [appState.reloadStatsSignal],
		() => getTotal(name),
		{
			initialValue: 0,
		}
	);

	return (
		<div class="alert alert-light d-lg-inline-block mt-4">
			<span class="me-2">Загалом громадян проголосувало:</span>
			<span class="badge rounded-pill bg-primary fs-6">{total()}</span>
		</div>
	);
}

async function getTotal(name) {
	const stats = await getVoteStats(name);

	return Object.values(stats).reduce((sum, item) => sum + item.count, 0);
}