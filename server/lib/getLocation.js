import {IS_DEV, MAPS} from '../config/index.js';
import axios from "axios";

const mapApi = axios.create({
    baseURL: 'https://api.mapbox.com',
    method: 'GET',
});

/**
 * @param {import('../models/bankid').Address} addr
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export default async function getLocation(addr) {
    if (isNA(addr.street)) {
        return null;
    }

    if (IS_DEV && !MAPS.access_token) {
        return MAPS.dev_location;
    }

    const {data} = await mapApi({
        url: '/search/geocode/v6/forward',
        params: {
            country: MAPS.country,
            region: MAPS.region,
            place: addr.city,
            street: addr.street.replace(/\.\s*/g, '. '),
            address_number: isNA(addr.houseNo) ? '' : addr.houseNo,
            limit: 1,
            access_token: MAPS.access_token,
        }
    });

    return data?.features?.[0]?.properties?.coordinates;
}

function isNA(v) {
    return !v || v === 'n/a';
}