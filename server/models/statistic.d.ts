import type {Knex} from 'knex';

export type Statistic = {
	rowid: number,
	poll: string,
	value: string,
	age: number,
	sex: 'M' | 'F',
	geo: string,
};

export type StatisticBuilder = Knex<Statistic>;