import {PUBLIC_MAP_TOKEN, MAP_CENTER} from "astro:env/client";
import mapbox, {Map} from 'mapbox-gl';
import type {GeoJSONSourceSpecification, GeoJSONSource} from "mapbox-gl";

type GeoData = GeoJSONSourceSpecification['data'];

mapbox.accessToken = PUBLIC_MAP_TOKEN;

export const COLORS = [
	'#FDE2E2',
	'#FCA5A5',
	'#F87171',
	'#B91C1C',
];

export function createMap(container: string): Map {
	const map = new Map({
		container,
		style: 'mapbox://styles/mapbox/streets-v12',
		center: JSON.parse(MAP_CENTER),
		zoom: 12,
	});

	map.on('load', function () {
		addCityRegions(map);
		addPlusCodeMapSource(map);
	});

	return map;
}

function addPlusCodeMapSource(map: Map) {
	map.addSource('pluscode-grid', {
		type: 'geojson',
		promoteId: 'plusCode',
		data: {
			type: 'FeatureCollection',
			features: []
		},
	});

	map.addLayer({
		id: 'grid-fill',
		type: 'fill',
		source: 'pluscode-grid',
		paint: {
			'fill-color': [
				'step', ['get', 'count'],
				COLORS[0], 1, // < t1
				COLORS[1], 2, // [t1, t2)
				COLORS[2], 3, // [t2, t3)
				COLORS[3] // >= t3
			],
			'fill-opacity': 0.75,
		}
	});

	map.addLayer({
		id: 'grid-outline',
		type: 'line',
		source: 'pluscode-grid',
		paint: {
			'line-color': '#8b0000',
			'line-width': 0.6,
			'line-opacity': 0.6
		}
	});

	map.addLayer({
		id: 'grid-labels',
		type: 'symbol',
		source: 'pluscode-grid',
		layout: {
			'text-field': ['to-string', ['get', 'count']],
			'text-font': ['Open Sans Semibold','Arial Unicode MS Bold'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 16],
			'text-allow-overlap': true,
			'text-ignore-placement': true
		},
		paint: {
			'text-color': '#111',
			'text-halo-color': '#fff',
			'text-halo-width': 1.5,
			'text-halo-blur': 0.5
		}
	});
}

function addCityRegions(map: Map) {
	map.addSource('city-regions', {
		type: 'geojson',
		data: '/geo/city-regions.json'
	});

	map.addLayer({
		id: 'city-regions-fill',
		type: 'fill',
		source: 'city-regions',
		paint: {
			'fill-color': '#1d5be1',
			'fill-opacity': 0.3
		},
		filter: ['==', ['geometry-type'], 'Polygon'],
	});

	map.addLayer({
		id: 'city-regions-line',
		type: 'line',
		source: 'city-regions',
		paint: {
			'line-width': 1
		},
		filter: ['==', ['geometry-type'], 'Polygon']
	});

	map.addLayer({
		id: 'city-regions-label',
		type: 'symbol',
		source: 'city-regions',
		layout: {
			'text-field': ['get', 'name'],
			'text-size': 12,
			'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
			'text-allow-overlap': false,
			'text-ignore-placement': false
		},
		paint: {
			'text-color': '#111',
			'text-halo-color': '#fff',
			'text-halo-width': 1.2
		},
		filter: ['==', ['geometry-type'], 'Polygon']
	});

	toggleCityRegions(map, false);
}

export function toggleCityRegions(map: Map, visible: boolean) {
	map.getStyle().layers
	.filter(l => l.source === 'city-regions')
	.forEach(l => {
		map.setLayoutProperty(l.id, 'visibility', visible ? 'visible' : 'none');
	});
}

export function updateMapData(map: Map, data: GeoData) {
	const src = map.getSource('pluscode-grid')! as GeoJSONSource;
	src.setData(data!);
}

export function buildGeoJSON(rows: Geo[]): GeoJSONSourceSpecification['data'] {
	return {
		type: 'FeatureCollection',
		features: rows.map(r => ({
			type: 'Feature',
			id: r.geo,
			properties: {
				plusCode: r.geo,
				count: r.count,
			},
			geometry: {
				type: 'Polygon',
				coordinates: [
					getSquare(r)
				]
			}
		}))
	};
}

function getSquare(geo: Geo) {
	const {lng, lat, res} = geo;
	const r = res / 2;

	return [
		[lng - r, lat - r],
		[lng + r, lat - r],
		[lng + r, lat + r],
		[lng - r, lat + r],
		[lng - r, lat - r],
	];
}

type Geo = {
	geo: string,
	lat: number,
	lng: number,
	res: number,
	count: number,
};