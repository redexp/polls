import {createResource} from "solid-js";
import {Switch, Match} from 'solid-js/web';
import {getVoteStats} from './AnswerLoader.jsx';
import appState from './appState.jsx';

export default function SummaryLoader({name}) {
	const [total] = createResource(() => [appState.reloadStatsSignal], () => getTotal(name));

	return (
		<div class="alert alert-light d-lg-inline-block mt-4">
			<span class="me-2">Загалом громадян проголосувало:</span>
			<Switch>
				<Match when={!!total.loading}>
					<span class="spinner-border"></span>
				</Match>

				<Match when={!total.loading}>
					<span class="badge rounded-pill bg-primary fs-6">{total()}</span>
				</Match>
			</Switch>
		</div>
	);
}

async function getTotal(name) {
	const stats = await getVoteStats(name);

	return Object.values(stats).reduce((sum, item) => sum + item.count, 0);
}