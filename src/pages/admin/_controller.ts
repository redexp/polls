import ajax from '@lib/ajax.js';
import {qs, each, loading, copyText} from '@lib/dom.ts';
import {error, success} from '@lib/notify.ts';
import {getAuthParams, getJwt, hasAuth, isAdmin, retrieveJwt} from '@lib/auth.ts';
import {showModal, showHelpModal} from '@lib/modal.ts';

type PollItem = {
	slug: string,
	title: string,
	expire: string|null,
	public: boolean,
	draft: boolean,
	groups: number,
	votes: number,
	error: string|null,
};

type BuildItem = {
	name: string,
	active: boolean,
};

const list = each<PollItem>('#polls', function (item, q) {
	const link = q<HTMLAnchorElement>('[data-title]');
	link.innerText = item.title;
	link.href = '/admin/edit/?slug=' + encodeURIComponent(item.slug);

	q('[data-votes]').innerText = String(item.votes);

	const err = q('[data-error]');
	err.innerText = item.error ? 'Помилка синтаксису: ' + item.error : '';

	q('[data-draft]').classList.toggle('d-none', !item.draft);

	const active = !item.expire || new Date(item.expire) > new Date();
	const activeBadge = q('[data-active]');

	// у чернетки немає ні «Активне», ні «Завершилось»: вона не опублікована,
	// тому її стан на сайті просто не існує
	activeBadge.classList.toggle('d-none', item.draft);
	activeBadge.innerText = active ? 'Активне' : 'Завершилось';
	activeBadge.classList.add(active ? 'text-bg-success' : 'text-bg-secondary');

	const pubBadge = q('[data-public]');
	pubBadge.innerText = item.public ? 'Публічне' : 'Анонімне';
	pubBadge.classList.add(item.public ? 'text-bg-info' : 'text-bg-light');

	q<HTMLAnchorElement>('[data-edit]').href = link.href;

	q<HTMLButtonElement>('[data-copy]').onclick = function () {
		copyPollUrl(item).catch(showError);
	};

	q<HTMLButtonElement>('[data-delete]').onclick = function () {
		removePoll(item).catch(showError);
	};
});

const builds = each<BuildItem>('#builds', function (item, q) {
	q('[data-name]').innerText = item.name;
	q('[data-current]').classList.toggle('d-none', !item.active);

	const btn = q<HTMLButtonElement>('[data-rollback]');

	btn.classList.toggle('d-none', item.active);

	btn.onclick = function () {
		loading(btn, true);

		ajax('/api/admin/rollback', {jwt: getJwt(), name: item.name})
		.then(function (data) {
			builds.reset(data.builds);
			success('Сайт відкочено на збірку ' + item.name);
		})
		.catch(showError)
		.finally(() => loading(btn, false));
	};
});

// пояснення лежать у <template> у сторінці
document.addEventListener('click', function (e) {
	const btn = (e.target as HTMLElement).closest?.('[data-help]') as HTMLElement|null;

	if (!btn) return;

	const source = document.getElementById(btn.dataset.help!);

	if (source) showHelpModal(source);
});

const publishBtn = qs<HTMLButtonElement>('#publish');
const log = qs<HTMLPreElement>('#log');

publishBtn.onclick = function () {
	publish().catch(showError);
};

const {auth_token} = getAuthParams();

if (auth_token) {
	await retrieveJwt(auth_token, true);
}

if (await isAdmin()) {
	await reload();
}
else {
	const modal = showModal('login-form');

	modal.node.classList.toggle('error', hasAuth());
}

async function reload() {
	const [pollsData, buildsData] = await Promise.all([
		ajax('/api/admin/polls/list', {jwt: getJwt()}),
		ajax('/api/admin/builds', {jwt: getJwt()}),
	]);

	list.reset(pollsData.polls);
	builds.reset(buildsData.builds);

	qs('#empty').classList.toggle('d-none', pollsData.polls.length > 0);
}

async function copyPollUrl(item: PollItem) {
	const url = location.origin + '/polls/' + item.slug + '/';

	if (!await copyText(url)) {
		error('Не вдалося скопіювати');
		return;
	}

	success(
		item.draft ?
			'Посилання скопійовано. Опитування — чернетка, тому сторінка ще не опублікована.' :
			'Посилання скопійовано'
	);
}

async function removePoll(item: PollItem) {
	// єдина незворотна операція в системі, і історії змін немає — тому
	// підтвердження вимагає ввести ідентифікатор, а не просто клікнути
	const text = (
		item.votes > 0 ?
			`Опитування «${item.title}» має ${item.votes} голосів.\n` +
			`Разом з ним будуть НАЗАВЖДИ знищені всі відповіді і вся статистика.\n\n` +
			`Введіть «${item.slug}», щоб підтвердити:` :
			`Видалити «${item.title}»?\n\nВведіть «${item.slug}», щоб підтвердити:`
	);

	const confirm = prompt(text);

	if (confirm === null) return;

	await ajax('/api/admin/polls/delete', {jwt: getJwt(), slug: item.slug, confirm});

	success('Опитування видалено');

	await reload();
}

async function publish() {
	loading(publishBtn, true);
	log.classList.remove('d-none');
	log.innerText = 'запуск...';

	try {
		let job = await ajax('/api/admin/publish', {jwt: getJwt()});

		while (job.status === 'running') {
			await wait(1000);

			job = await ajax('/api/admin/publish/status', {jwt: getJwt(), job_id: job.job_id});

			log.innerText = job.log.join('\n');
		}

		log.innerText = job.log.join('\n');

		if (job.status === 'failed') {
			error(job.error || 'Збірка не вдалася');
		}
		else {
			success('Сайт опубліковано');
		}

		await reload();
	}
	finally {
		loading(publishBtn, false);
	}
}

function wait(ms: number): Promise<void> {
	return new Promise(done => setTimeout(done, ms));
}

function showError(err: any) {
	if (err instanceof Response) return; // ajax уже показав повідомлення

	error(err?.message || 'Помилка запиту');
}
