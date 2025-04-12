import {generateKeyPairSync} from 'crypto';
import {writeFileSync, existsSync} from 'fs';
import {resolve} from 'path';

const cwd = process.cwd();

const {publicKey, privateKey} = generateKeyPairSync('rsa', {
	modulusLength: 2048,
});

const privPath = resolve(cwd, 'statistic_private_key.pem');

writeFileSync(privPath, privateKey.export({type: 'pkcs1', format: 'pem'}));
console.log('🔐 Приватний ключ:', privPath);

const privatePem = publicKey.export({type: 'pkcs1', format: 'pem'});
const pubPath = resolve(cwd, 'server', 'statistic_public_key.pem.json');

writeFileSync(pubPath, JSON.stringify(privatePem));
console.log('\n🔓 Публичный ключ:', pubPath);
