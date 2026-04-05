const { execFileSync } = require('node:child_process');
const { createPrivateKey } = require('node:crypto');
const { readdir } = require('node:fs/promises');
const path = require('node:path');

const { AssetManager } = require('@icp-sdk/canisters/assets');
const { HttpAgent } = require('@icp-sdk/core/agent');
const { Secp256k1KeyIdentity } = require('@icp-sdk/core/identity/secp256k1');

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');

const CANISTER_ID = 'sa6ad-byaaa-aaaas-qge3a-cai';
const HOST = 'https://icp-api.io';
const IDENTITY_NAME = process.argv[2] || 'fatturavault-staging';

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				return walk(fullPath);
			}
			return [fullPath];
		})
	);

	return files.flat();
}

function toCanisterPath(filePath) {
	const relativePath = path.relative(buildDir, filePath).replaceAll('\\', '/');
	const directoryPath = path.posix.dirname(`/${relativePath}`);
	return {
		fileName: path.posix.basename(relativePath),
		path: directoryPath === '/' ? '' : directoryPath
	};
}

function readPemFromIdentity(identityName) {
	return execFileSync(
		'powershell.exe',
		['-NoProfile', '-Command', `icp identity export ${identityName}`],
		{
		cwd: projectRoot,
		encoding: 'utf8'
		}
	);
}

function base64UrlToBytes(value) {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	return Uint8Array.from(Buffer.from(padded, 'base64'));
}

async function main() {
	const pem = readPemFromIdentity(IDENTITY_NAME);
	const privateKey = createPrivateKey(pem);
	const jwk = privateKey.export({ format: 'jwk' });
	if (!jwk.d) {
		throw new Error('Impossibile estrarre il secret key dalla identity staging.');
	}
	const identity = Secp256k1KeyIdentity.fromSecretKey(base64UrlToBytes(jwk.d));
	const agent = await HttpAgent.create({
		host: HOST,
		identity
	});

	const manager = new AssetManager({
		canisterId: CANISTER_ID,
		agent,
		concurrency: 8
	});

	const files = await walk(buildDir);
	if (!files.length) {
		throw new Error('La cartella build è vuota. Esegui prima npm run build.');
	}

	console.log(`Pulizia asset canister ${CANISTER_ID}...`);
	await manager.clear();

	console.log(`Upload di ${files.length} file verso ${CANISTER_ID}...`);
	for (const filePath of files) {
		const target = toCanisterPath(filePath);
		console.log(`- ${target.path}/${target.fileName}`);
		await manager.store(filePath, target);
	}

	console.log(`Deploy completato su https://${CANISTER_ID}.icp0.io/`);
}

main().catch((error) => {
	console.error('Deploy staging fallito.');
	console.error(error);
	process.exitCode = 1;
});
