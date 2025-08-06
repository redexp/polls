import {update} from '../lib/env.js';

const BANKID = {
	dev_port: 8001,
	url: '',
	client_id: '',
	client_secret: '',
	dataset: 51,
};

update(BANKID, 'BANKID_');

const local = 'http://localhost:';

if (!BANKID.url) {
	BANKID.url = local + BANKID.dev_port;
}

if (!BANKID.callback_url) {
	BANKID.callback_url = '/bankid/callback';
}

export default BANKID;