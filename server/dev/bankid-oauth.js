import express from "express";
import {IS_DEV, SERVER, BANKID, ASTRO_URL} from "../config.js";
import {randomUUID} from "crypto";
import moment from 'moment';

const app = express();
const DEV_PORT = BANKID.dev_port;
const url = new URL(BANKID.url);

app.listen(DEV_PORT, () => {
	console.log(url.toString());
});

app.use(express.urlencoded({extended: true}));

const root = express.Router({mergeParams: true});

app.use(url.pathname, root);

root.get('/oauth2/authorize', function (req, res) {
	let params = '';
	const {state} = req.query;

	if (state) {
		params = '?' + qs({state});
	}

	res.redirect((IS_DEV ? ASTRO_URL : SERVER.url) + '/bankid/dev-login' + params);
});

const store = new Map();

root.post('/oauth2/callback', function (req, res) {
	const {state, ...data} = req.body;
	const code = randomUUID();
	const access_token = randomUUID();

	data.birthDay = moment(data.birthDay).format('DD.MM.Y');
	data.addresses = [data.addresses];

	store.set(code, {access_token, expires_in: 180});
	store.set(access_token, data);

	res.redirect(SERVER.url + '/bankid/callback?' + qs({code, state}));
});

root.post('/oauth2/token', function (req, res) {
	const {code} = req.body;

	res.json(store.get(code));
});

root.post('/resource/client', function (req, res) {
	const auth = req.headers['authorization'];

	res.json(store.get(auth.replace('Bearer ', '')));
});

function qs(data) {
	return (new URLSearchParams(data)).toString();
}
