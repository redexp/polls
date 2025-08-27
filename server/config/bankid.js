import {update} from '../lib/env.js';

const BANKID = {
	dev_port: 8001,
	url: '',
	client_id: '',
	client_secret: '',
	dataset: 51,
	callback_url: '/bankid/callback',
	crypto_url: '',
};

update(BANKID, 'BANKID_');

const local = 'http://localhost:';

if (!BANKID.url) {
	BANKID.url = local + BANKID.dev_port;
}

if (!BANKID.crypto_url) {
	BANKID.crypto_url = local + 8002;
}

export default BANKID;