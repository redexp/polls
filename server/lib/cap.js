/**
 * @param {string} word
 * @returns {string}
 */
export default function cap(word) {
	if (word.length === 0) return word;

	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}