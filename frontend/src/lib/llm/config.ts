import { browser } from '$app/environment';

export const LOCAL_LLM_STORAGE_KEY = 'fatturavault-local-llm-config';
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export const OPENAI_MODEL_OPTIONS = [
	{
		value: 'gpt-4.1-mini',
		label: 'GPT-4.1 mini'
	},
	{
		value: 'gpt-4.1-nano',
		label: 'GPT-4.1 nano'
	},
	{
		value: 'gpt-4o',
		label: 'GPT-4o'
	}
] as const;

export type LocalLlmConfig = {
	apiKey: string;
	model: string;
	enabled: boolean;
	updatedAt: string;
};

function normalizeConfig(value: unknown): LocalLlmConfig | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const maybe = value as Partial<LocalLlmConfig>;

	return {
		apiKey: typeof maybe.apiKey === 'string' ? maybe.apiKey.trim() : '',
		model:
			typeof maybe.model === 'string' && maybe.model.trim()
				? maybe.model.trim()
				: DEFAULT_OPENAI_MODEL,
		enabled: maybe.enabled !== false,
		updatedAt:
			typeof maybe.updatedAt === 'string' && maybe.updatedAt
				? maybe.updatedAt
				: new Date().toISOString()
	};
}

export function getLocalLlmConfig() {
	if (!browser) {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(LOCAL_LLM_STORAGE_KEY);
		if (!raw) {
			return null;
		}

		return normalizeConfig(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function hasActiveLocalLlmConfig() {
	const config = getLocalLlmConfig();
	if (!config?.enabled) {
		return false;
	}

	return Boolean(config.apiKey);
}

export function saveLocalLlmConfig(input: {
	apiKey?: string;
	model?: string;
	enabled?: boolean;
}) {
	if (!browser) {
		return null;
	}

	const normalized: LocalLlmConfig = {
		apiKey: input.apiKey?.trim() || '',
		model: input.model?.trim() || DEFAULT_OPENAI_MODEL,
		enabled: input.enabled !== false,
		updatedAt: new Date().toISOString()
	};

	window.localStorage.setItem(LOCAL_LLM_STORAGE_KEY, JSON.stringify(normalized));
	return normalized;
}

export function clearLocalLlmConfig() {
	if (!browser) {
		return;
	}

	window.localStorage.removeItem(LOCAL_LLM_STORAGE_KEY);
}
