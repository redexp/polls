import {getCollection, type CollectionEntry} from 'astro:content';

export const polls = await getCollection('polls');

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