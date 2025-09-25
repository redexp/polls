import express from 'express';
import {reloadPollsData} from './models/polls.js';
import {SERVER} from './config/index.js';
import {router as bankid} from './bankid.js';
import {router as answers} from './answers.js';
import {router as map} from './map.js';

reloadPollsData()
.catch(err => {
	console.error(err);
	process.exit(1);
});

const app = express();

app.use(express.json());

app.use(bankid);
app.use('/api/answers', answers);
app.use('/api/map', map);

app.use(function (err, _req, res, _next) {
	res.sendStatus(500);

	console.error('Unhandled', err?.message, err?.stack);
});

app.listen(SERVER.port, () => {
	console.log('http://localhost:' + SERVER.port);
});