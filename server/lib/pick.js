/**
 * @param {object} src
 * @param {string[]} props
 * @returns {object}
 */
export default function pick(src, props) {
	const target = {};

	for (const prop of props) {
		if (src.hasOwnProperty(prop)) {
			target[prop] = src[prop];
		}
	}

	return target;
}