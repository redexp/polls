const MESSAGES = {
	invalid_slug: 'Ідентифікатор може містити лише малі латинські літери, цифри і дефіс',
	invalid_path: 'Некоректний шлях до файлу опитування',
	slug_locked: 'Опитування вже має голоси, тому його ідентифікатор змінити неможливо',
	slug_conflict: 'Опитування з таким ідентифікатором вже існує',
	values_locked: 'За ці варіанти вже проголосували, тому видалити або перейменувати їх неможливо',
	group_type_locked: 'Тип групи змінити неможливо: за її варіанти вже проголосували',
	confirm_mismatch: 'Для видалення потрібно ввести ідентифікатор опитування',
	not_found: 'Опитування не знайдено',
	empty_title: 'Заголовок опитування не може бути порожнім',
	no_groups: 'Опитування має містити хоча б одну групу з варіантами',
	invalid_range: 'Некоректне обмеження групи',
	duplicate_range: 'У групі більше одного обмеження',
	invalid_closing_bracket: 'Рядок схожий на варіант відповіді, але дужка не закрита',
	empty_value: 'Порожнє значення варіанта',
	value_duplicate: 'Значення варіанта повторюється',
	mix_types: 'У одній групі змішані типи варіантів: [checkbox] і (radio)',
	poll_duplicate: 'Файл з таким ідентифікатором вже існує (враховуючи підтеки)',
	build_in_progress: 'Збірка вже виконується, дочекайтесь завершення',
	invalid_build: 'Некоректна назва збірки',
	symlink_failed: 'Не вдалося переставити симлінк dist — перевірте права на файлову систему',
	unknown_build: 'Такої збірки немає',
	job_not_found: 'Задача не знайдена',
};

/**
 * @param {import('express').Response} res
 * @param {*} err
 */
export function sendError(res, err) {
	const type = err?.type;

	if (!type || !MESSAGES.hasOwnProperty(type)) {
		throw err;
	}

	res.status(400);
	res.json({
		type,
		message: MESSAGES[type],
		...err,
	});
}

/**
 * Обгортка, щоб кожен хендлер не повторював try/catch.
 *
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} fn
 * @returns {import('express').RequestHandler}
 */
export function handler(fn) {
	return function (req, res, next) {
		Promise.resolve()
		.then(() => fn(req, res))
		.catch(function (err) {
			try {
				sendError(res, err);
			}
			catch (unknown) {
				next(unknown);
			}
		});
	};
}
