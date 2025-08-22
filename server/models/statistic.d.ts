import type {Knex} from 'knex';

export type Statistic = {
	rowid: number,
	user_id: string,
	poll: string,
	value: string,
	age: number,
	sex: 'M' | 'F',
	geo: `${string}+`|'no_loc', // Plus Code
};

export type Archive = {
	rowid: number,
	poll: string,
	data: string,
};

export type StatisticBuilder = Knex<Statistic>;
export type ArchiveBuilder = Knex<Archive>;

export type UserData = Pick<Statistic, 'age' | 'sex' | 'geo'> & {
	bank_id: string,
	user_id?: string,
	name?: string,
};

export type StatisticValues = [Statistic['user_id'], Statistic['value'], Statistic['age'], Statistic['sex'], Statistic['geo']];