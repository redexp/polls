/**
 * Ідентифікатор картинки в тексті опитування. Спільна форма для ключів мапи
 * `images` і для назв полів з файлами: і там, і там це той самий id.
 */
export const IMAGE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Зіставляє файли з multipart з ідентифікаторами картинок: назва поля і є id.
 * Кожному видається ім'я файлу наперед — воно потрібне ще до обробки, бо
 * потрапляє в адресу, яку перевіряє решта збереження.
 *
 * Будь-яка розбіжність — помилка, а не мовчазний вибір одного з варіантів:
 * повторений id чи id, який уже має збережену адресу, означає зламаного
 * клієнта, і правило «останній виграє» підмінило б картинку непомітно.
 *
 * @param {Array<{fieldname: string, buffer: Buffer}>} files
 * @param {Set<string>} taken id картинок, що вже мають адресу на сервері
 * @param {() => string} newName
 * @returns {Map<string, {name: string, buffer: Buffer}>} id → нова картинка
 */
export function mapImageFields(files, taken, newName) {
	const images = new Map();

	for (const file of files || []) {
		const id = file.fieldname;

		if (!IMAGE_ID_RE.test(id) || images.has(id) || taken.has(id)) {
			throw {type: 'invalid_body'};
		}

		images.set(id, {name: newName(), buffer: file.buffer});
	}

	return images;
}
