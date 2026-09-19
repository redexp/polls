/**
 * @typedef {Object} RequestConfig
 * @property {string} [url]
 * @property {string} [baseURL]
 * @property {string} [method] GET за замовчуванням
 * @property {Record<string, string>} [headers]
 * @property {Record<string, any>} [params] query-параметри; undefined/null пропускаються
 * @property {any} [data] тіло запиту: об'єкт → JSON (або form-urlencoded, якщо так задано в content-type)
 *
 * @typedef {Object} Response
 * @property {any} data розпарсений JSON або текст
 * @property {number} status
 * @property {string} statusText
 * @property {Headers} headers
 * @property {RequestConfig} config
 */

export class AjaxError extends Error {
	/**
	 * @param {string} message
	 * @param {string} code
	 * @param {RequestConfig} config
	 * @param {Response} [response]
	 * @param {unknown} [cause]
	 */
	constructor(message, code, config, response, cause) {
		super(message, {cause});
		this.name = 'AjaxError';
		this.code = code;
		this.config = config;
		this.response = response;
	}
}

/**
 * @param {RequestConfig} [defaults]
 * @returns {(config: RequestConfig) => Promise<Response>}
 */
export function createAjax(defaults = {}) {
	/** @param {RequestConfig} config */
	function ajax(config = {}) {
		return request({
			...defaults,
			...config,
			headers: {...defaults.headers, ...config.headers},
		});
	}

	return ajax;
}

/**
 * @param {RequestConfig} config
 * @returns {Promise<Response>}
 */
export async function request(config) {
	const url = buildUrl(config);
	const method = (config.method || 'GET').toUpperCase();
	const headers = new Headers(config.headers);
	const body = serializeBody(config.data, headers, method);

	let res;

	try {
		res = await fetch(url, {method, headers, body});
	}
	catch (err) {
		throw new AjaxError(err?.message || 'Network Error', 'ERR_NETWORK', config, undefined, err);
	}

	/** @type {Response} */
	const response = {
		data: parseBody(await res.text()),
		status: res.status,
		statusText: res.statusText,
		headers: res.headers,
		config,
	};

	if (!res.ok) {
		throw new AjaxError(
			`Request failed with status code ${res.status}`,
			res.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
			config,
			response,
		);
	}

	return response;
}

/**
 * @param {RequestConfig} config
 * @returns {string}
 */
function buildUrl({baseURL, url = '', params}) {
	const isAbsolute = /^[a-z][a-z\d+.-]*:\/\//i.test(url);

	let full = (
		baseURL && !isAbsolute ?
			baseURL.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '') :
			url
	);

	if (params) {
		const qs = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === null) continue;

			qs.append(key, value);
		}

		const str = qs.toString();

		if (str) {
			full += (full.includes('?') ? '&' : '?') + str;
		}
	}

	return full;
}

/**
 * @param {any} data
 * @param {Headers} headers
 * @param {string} method
 * @returns {BodyInit|undefined}
 */
function serializeBody(data, headers, method) {
	if (data === undefined || data === null || method === 'GET' || method === 'HEAD') {
		return undefined;
	}

	if (
		typeof data === 'string' ||
		data instanceof URLSearchParams ||
		data instanceof FormData ||
		data instanceof Blob ||
		data instanceof ArrayBuffer ||
		ArrayBuffer.isView(data)
	) {
		return data;
	}

	const type = headers.get('content-type') || '';

	if (type.includes('application/x-www-form-urlencoded')) {
		return new URLSearchParams(data);
	}

	if (!type) {
		headers.set('content-type', 'application/json');
	}

	return JSON.stringify(data);
}

/**
 * Як ajax за замовчуванням: пробує JSON, інакше віддає текст як є.
 * @param {string} text
 * @returns {any}
 */
function parseBody(text) {
	try {
		return JSON.parse(text);
	}
	catch {
		return text;
	}
}
