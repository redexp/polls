import type {Moment} from "moment";

export type PollMeta = {
	id: string,
	expire?: Moment,
	public: boolean,
	values: string[],
	groups: ValuesGroup[],
};

export type ValuesGroup = {
	type: 'checkbox'|'radio',
	values: string[],
};