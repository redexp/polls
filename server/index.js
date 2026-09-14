import express from 'express';
import {reloadPollsData} from './models/polls.js';
import {SERVER, UPLOADS_DIR, IMAGES_URL} from './config/index.js';
import {router as bankid} from './bankid.js';
import {router as answers} from './answers.js';
import {router as map} from './map.js';
import {router as admin} from './admin/index.js';

reloadPollsData()
.catch(err => {
	console.error(err);
	process.exit(1);
});

const app = express();

app.use(express.json());

// у prod цей шлях віддає nginx напряму з UPLOADS_DIR; сюди запити доходять лише
// в dev через проксі vite. Файли незмінні — нове завантаження дає нове ім'я
app.use(IMAGES_URL, express.static(UPLOADS_DIR, {immutable: true, maxAge: '1y'}));

app.use(bankid);
app.use('/api/answers', answers);
app.use('/api/map', map);
app.use('/api/admin', admin);

app.use(function (err, _req, res, _next) {
	res.sendStatus(500);

	console.error('Unhandled', err?.message, err?.stack);
});

app.listen(SERVER.port, () => {
	console.log('http://localhost:' + SERVER.port);
});