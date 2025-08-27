import ajax from '../../lib/ajax.js';
import {getValues, qs, each} from '@lib/dom.ts';
import {error} from '@lib/notify.ts';
import {createMap, buildGeoJSON, updateMapData, toggleCityRegions} from '@lib/map.ts';

const map = createMap('map');

const params = new URLSearchParams(location.search);
const poll_id = params.get('poll')!;

type Answer = {
	value: string,
	count: number,
};

const answers = each<Answer>('#values', function ({value, count}, q) {
	q<HTMLInputElement>('input').value = value;
	q('span').innerText = value;
	q('strong').innerText = String(count);
});

type Filter = {
	poll_id: string,
	values: string[],
	sex: string[],
	age: Array<number[]>,
	active?: boolean,
};

const filters: Filter[] = [];

const legend = each<Filter & {title?: string}>('#legend', function (item, q) {
	const {title, values, sex, age} = item;

	q('span').innerText = title || (
		[
			values,
			sex.map(s => s === 'F' ? 'Жінки' : 'Чоловіки'),
			age.map(range => range.join('-')),
		]
		.map(list => list.join(', '))
		.filter(v => !!v.trim())
		.join('; ')
	) || 'Усі відповіді';

	q('button').onclick = function () {
		const index = filters.indexOf(item);
		if (index > -1) {
			filters.splice(index, 1);
		}

		legend.remove(item);
		updateMap();
	};

	q('input').onchange = function (e) {
		const inp = e.target as HTMLInputElement;
		item.active = inp.checked;
		updateMap();
	};
});

addCityRegions();

await updateAnswers();

qs('form').addEventListener('change', function () {
	updateCounts()
	.catch(err => error(err.message || 'Server error'));
});

qs('form').addEventListener('submit', function (e) {
	e.preventDefault();

	const item = getFilter();

	item.active = true;

	filters.push(item);
	legend.add(item);

	updateMap();
});

await updateCounts();

function getFilter(): Filter {
	const values = getValues('[name="value"]:checked');
	const sex = getValues('[name="sex"]:checked');
	const age = getValues('[name="age"]:checked').map(range => range.split('-').map(v => Number(v)));

	return {
		poll_id,
		values,
		sex,
		age,
	};
}

async function updateAnswers() {
	const list: Answer[] = await ajax('/api/map/answers', {poll_id});

	answers.reset(list);
}

async function updateCounts() {
	type Counts = {
		value: { [value: string]: number },
		sex: { [value: string]: number },
		age: { [value: string]: number },
	};

	const counts: Counts = await ajax('/api/map/counts', getFilter());

	for (const name in counts) {
		for (const [value, count] of Object.entries(counts[name])) {
			const label = qs(`label:has(input[name="${name}"][value="${value}"])`);
			label.classList.toggle('opacity-50', count === 0);
			label.querySelector('strong')!.innerText = String(count);
		}
	}
}

function addCityRegions() {
	const cityRegions = {
		poll_id,
		title: 'Регіони міста',
		values: [],
		sex: [],
		age: [],
	};

	legend.add(cityRegions);

	const node = legend.nodes.get(cityRegions)!;
	const input = node.querySelector('input')! as HTMLInputElement;

	input.checked = false;

	input.onchange = function () {
		toggleCityRegions(map, input.checked);
	};
}

async function updateMap() {
	const list = await ajax('/api/map/geo', filters.filter(item => item.active));

	updateMapData(map, buildGeoJSON([].concat(...list)));
}