
export function update(config, prefix = '') {
	for (const key in config) {
		const value = config[key];

		if (value && typeof value === 'object') {
			update(value, prefix + key + '_');
			continue;
		}

		const env = get((prefix + key).toUpperCase());

		if (typeof env === 'undefined') continue;

		config[key] = env;
	}
}

export function get(name) {
	const pEnv = process.env;
	const iEnv = import.meta.env || {};

	return (
		pEnv.hasOwnProperty(name) ?
			pEnv[name] :
			iEnv.hasOwnProperty(name) ?
				iEnv[name] :
				undefined
	);
}

export function getJson(name, def) {
	const json = get(name);

	return (
		json ?
			JSON.parse(json) :
			def
	);
}