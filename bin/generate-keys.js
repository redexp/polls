import {generateKeyPairSync, randomBytes} from 'crypto';
import {writeFileSync} from 'fs';
import {resolve} from 'path';

const cwd = process.cwd();

const jwtKeyPath = resolve(cwd, 'server', 'jwt.key');

writeFileSync(jwtKeyPath, randomBytes(32).toString('hex'));
console.log('Ключ для шифрування jwt:', jwtKeyPath);

const {publicKey, privateKey} = generateKeyPairSync('rsa', {
	modulusLength: 2048,
});

const pubPath = resolve(cwd, 'server', 'statistic_public_key.pem');

writeFileSync(pubPath, publicKey.export({type: 'pkcs1', format: 'pem'}));
console.log('Публічний ключ для шифрування статистики:', pubPath);

const privPath = resolve(cwd, 'statistic_private_key.pem');

writeFileSync(privPath, privateKey.export({type: 'pkcs1', format: 'pem'}));
console.log('Приватний ключ для розшифрування статистики:', privPath);
