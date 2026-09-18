const MESSAGES = {
	invalid_slug: 'Ідентифікатор може містити лише малі латинські літери, цифри і дефіс',
	invalid_path: 'Некоректний шлях до файлу опитування',
	slug_locked: 'Опитування вже має голоси, тому його ідентифікатор змінити неможливо',
	slug_conflict: 'Опитування з таким ідентифікатором вже існує',
	values_locked: 'За ці варіанти вже проголосували, тому видалити або перейменувати їх неможливо',
	group_type_locked: 'Тип відповіді змінити неможливо: за варіанти цього питання вже проголосували',
	confirm_mismatch: 'Для видалення потрібно ввести ідентифікатор опитування',
	not_found: 'Опитування не знайдено',
	empty_title: 'Заголовок опитування не може бути порожнім',
	no_groups: 'Опитування має містити хоча б одне питання з варіантами відповідей',
	invalid_range: 'Некоректне обмеження кількості відповідей',
	duplicate_range: 'У питанні більше одного обмеження кількості відповідей',
	invalid_closing_bracket: 'Рядок схожий на варіант відповіді, але дужка не закрита',
	empty_value: 'Порожнє значення варіанта',
	value_duplicate: 'Значення варіанта повторюється',
	mix_types: 'У одному питанні змішані типи варіантів: [кілька] і (одна)',
	retype_conflict: 'Значення варіанта містить дужку, тому тип відповіді змінити неможливо — спершу виправте значення',
	poll_duplicate: 'Файл з таким ідентифікатором вже існує (враховуючи підтеки)',
	build_in_progress: 'Збірка вже виконується, дочекайтесь завершення',
	invalid_build: 'Некоректна назва збірки',
	symlink_failed: 'Не вдалося переставити симлінк dist — перевірте права на файлову систему',
	unknown_build: 'Такої збірки немає',
	job_not_found: 'Задача не знайдена',
	image_unknown: 'Картинку не знайдено на сервері — додайте її знову або видаліть з тексту',
	image_type: 'Підтримуються лише картинки png, jpg і webp',
	image_too_large: 'Картинка більша за 3 МБ',
	too_many_images: 'За раз можна завантажити не більше 10 картинок',
	poll_too_large: 'Опитування завелике — скоротіть текст',
	invalid_body: 'Некоректний запит',
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
