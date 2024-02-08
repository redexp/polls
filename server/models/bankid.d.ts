export type Client = {
	bank_id: string | null,

	cert: string,
	memberId: string,
	sidBi: string,
	type: "physical",

	name: string,
	firstName: string,
	lastName: string,
	middleName: string | NA,
	phone: `380${number}`,
	inn: `${number}` | `${string}${number}` | NA,
	clId?: string,
	clIdText?: `Інформація надана з використанням Системи BankID НБУ ${number}.${number}.${number} ${number}:${number}`,
	birthDay: DateFormat,
	birthPlace: string | NA,
	nationality?: CountryCode,
	sex: "M" | "F",
	email: string | NA,
	socStatus?: string,
	workPlace?: string,
	position?: string,
	flagPEPs?: 0 | 1,
	flagPersonTerror?: 0 | 1,
	flagRestriction?: 0 | 1,
	flagTopLevelRisk?: 0 | 1,
	uaResident?: 0 | 1,
	phoneNumberChange?: DateFormat,
	identificationDate?: DateFormat,

	addresses: Address[],
	documents: Document[],
};

export type CountryCode = "UA" | "UKR" | "Україна" | "Ukraine";
export type DateFormat = `${number}.${number}.${number}`;
export type NA = "n/a";

export type Address = {
	type: "factual" | "juridical",
	country: CountryCode,
	index?: `${number}`,
	state: string | NA,
	area: string | NA,
	city: string,
	street: string | NA,
	houseNo: string | NA,
	flatNo: string | NA,
};

export type Document = {
	type: "passport" | "idpassport" | "zpassport" | "ident",
	typeName?: string,
	series: string | NA,
	number: string,
	issue: string,
	dateIssue: DateFormat,
	dateExpiration: DateFormat | NA,
	recordEDDR?: `${number}-${number}`,
	issueCountryIso2?: CountryCode,
};

export type ValidationErrorTypes = 'no_id' | 'no_name' | 'no_juridical_address' | 'invalid_address';