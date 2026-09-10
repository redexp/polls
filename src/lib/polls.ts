import {getCollection, type CollectionEntry} from 'astro:content';

// чернетки не потрапляють у збірку взагалі — інакше сторінка була б доступна за
// прямим URL, попри відсутність опитування в списках
export const polls = (await getCollection('polls')).filter(poll => !poll.data.draft);

export type Poll = CollectionEntry<'polls'>;

export function getPolls(folder?: string): Poll[] {
	if (!folder) {
		return polls.filter(p => !p.id.includes('/'));
	}

	return polls.filter(p => p.id.startsWith(folder + '/'));
}

export function getActivePastPolls(): [Poll[], Poll[]] {
	const now = new Date();

	const active: Poll[] = [];
	const past: Poll[] = [];

	for (const poll of getPolls()) {
		if (!poll.data.expire || now < poll.data.expire) {
			active.push(poll);
		}
		else {
			past.push(poll);
		}
	}

	return [active, past];
}