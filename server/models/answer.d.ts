import type {Knex} from 'knex';

export type Answer = {
	id: number,
	bank_id: string,
	name: string,
	age: number,
	sex: 'M' | 'F',
	poll: string,
	value: string,
	created_at: string,
};

export type AnswerProps = Array<keyof Answer>;

export type AnswersBuilder = Knex<Answer>

