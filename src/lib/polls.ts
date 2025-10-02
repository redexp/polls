import {getCollection, type CollectionEntry} from 'astro:content';

export const polls = await getCollection('polls');

export type Poll = CollectionEntry<'polls'>;

export function getPolls(folder?: string): Poll[] {
	if (!folder) {
		return polls.filter(p => !p.id.includes('/'));
	}

	return polls.filter(p => p.id.startsWith(folder + '/'));
}

