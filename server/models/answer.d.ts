import type {Knex} from 'knex';

export type Answer = {
	id: number,
	bank_id: string,
	poll: string,
	value: string,
	name: string,
	created_at: string,
};

export type AnswerProps = Array<keyof Answer>;

export type AnswersBuilder = Knex<Answer>;

export type PollsStats = {
	[poll: string]: {
		[value: string]: {
			count: number,
			percent: number,
			winner: boolean,
		}
	}
};

export type PollsInfo = Map<string, {values: Array<Answer['value']>, created_at: Answer['created_at']}>

