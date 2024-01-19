import express from "express";
import {PORT, BANKID, ASTRO_URL} from "../config.js";
import {randomUUID} from "crypto";

const app = express();
const DEV_PORT = BANKID.dev_port;

app.listen(DEV_PORT, () => {
	console.log('http://locahost:' + DEV_PORT);
});

app.get('/oauth2/authorize', function (req, res) {
	let params = '';
	const {state} = req.query;

	if (state) {
		params = '?' + qs({state});
	}

	res.redirect(ASTRO_URL + '/dev/bankid-login' + params);
});

const store = new Map();

app.get('/oauth2/callback', function (req, res) {
	const {state, name, age, sex} = req.query;
	const code = randomUUID();
	const access_token = randomUUID();

	store.set(code, {access_token, expires_in: 180});
	store.set(access_token, {bank_id: randomUUID(), name, age, sex});

	res.redirect('http://localhost:' + PORT + '/bankid/callback?' + qs({code, state}));
});

app.post('/oauth2/token', express.urlencoded({extended: false}), function (req, res) {
	const {code} = req.body;

	res.json(store.get(code));
});

app.post('/resource/client', function (req, res) {
	const auth = req.headers['authorization'];

	res.json(store.get(auth.replace('Bearer ', '')));
});

function qs(data) {
	return (new URLSearchParams(data)).toString();
}
