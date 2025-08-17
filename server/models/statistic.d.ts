import type {Knex} from 'knex';

export type Statistic = {
	rowid: number,
	poll: string,
	value: string,
	age: number,
	sex: 'M' | 'F',
	geo: `${string}+`, // Plus Code
};

export type StatisticBuilder = Knex<Statistic>;

export type StatisticData = Omit<Statistic, 'rowid' | 'poll' | 'value'> & {bank_id: string, name: string};

export type StatisticValues = [Statistic['poll'], Statistic['value'], Statistic['age'], Statistic['sex'], Statistic['geo']];