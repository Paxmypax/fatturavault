const { execFileSync } = require('node:child_process');
const { createPrivateKey } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { readdir } = require('node:fs/promises');
const path = require('node:path');

const { AssetManager } = require('@icp-sdk/canisters/assets');
const { HttpAgent } = require('@icp-sdk/core/agent');
const { Secp256k1KeyIdentity } = require('@icp-sdk/core/identity/secp256k1');

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return;
	}

	const raw = readFileSync(filePath, 'utf8');
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const separatorIndex = trimmed.indexOf('=');
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		if (!key || process.env[key] != null) {
			continue;
		}

		let value = trimmed.slice(separatorIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		process.env[key] = value;
	}
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env.staging'));
loadEnvFile(path.join(projectRoot, '.env.staging.local'));

const CANISTER_ID = process.env.DEPLOY_FRONTEND_CANISTER_ID;
const HOST = process.env.DEPLOY_ICP_HOST || 'https://icp-api.io';
const IDENTITY_NAME = process.argv[2] || process.env.DEPLOY_IDENTITY_NAME;

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
	if (!CANISTER_ID) {
		throw new Error(
			'Manca DEPLOY_FRONTEND_CANISTER_ID. Impostalo in frontend/.env.local o frontend/.env.staging.'
		);
	}

	if (!IDENTITY_NAME) {
		throw new Error(
			'Manca DEPLOY_IDENTITY_NAME. Impostalo in frontend/.env.local o frontend/.env.staging.'
		);
	}

	const pem = readPemFromIdentity(IDENTITY_NAME);
	const privateKey = createPrivateKey(pem);
	const jwk = privateKey.export({ format: 'jwk' });
	if (!jwk.d) {
		throw new Error('Impossibile estrarre il secret key dalla identity di deploy.');
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
