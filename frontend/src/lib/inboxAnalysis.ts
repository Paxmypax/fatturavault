import { browser } from '$app/environment';
import { getLocalLlmConfig, hasActiveLocalLlmConfig } from '$lib/llm/config';
import { runOpenAiInboxAnalysis } from '$lib/llm/openai';
import type { InboxAnalysisStatus } from '$lib/types';

const OPENAI_DIRECT_IMAGE_BYTES_LIMIT = 4_000_000;

export type InboxAnalysisResult = {
	analysisStatus: InboxAnalysisStatus;
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryName?: string;
	suggestedTags: string[];
	extractedPayloadJson?: string;
	extractedDocumentDate?: string;
	extractedMerchantName?: string;
	extractedAmount?: number;
	extractedPaymentStatus?: 'due' | 'paid';
};

const CATEGORY_RULES: Array<{
	categoryName: string;
	keywords: string[];
	tags: string[];
}> = [
	{ categoryName: 'Fattura', keywords: ['fattura', 'invoice', 'fatt'], tags: ['fattura'] },
	{ categoryName: 'Ricevuta', keywords: ['ricevuta', 'scontrino', 'receipt'], tags: ['ricevuta'] },
	{ categoryName: 'Garanzia', keywords: ['garanzia', 'warranty'], tags: ['garanzia'] },
	{ categoryName: 'Assicurazione', keywords: ['assicurazione', 'polizza'], tags: ['polizza'] },
	{ categoryName: 'Auto', keywords: ['auto', 'carburante', 'bollo'], tags: ['auto'] },
	{
		categoryName: 'Abbonamento',
		keywords: ['abbonamento', 'subscription', 'canone'],
		tags: ['abbonamento']
	},
	{
		categoryName: 'Casa',
		keywords: [
			'affitto',
			'utenza',
			'condominio',
			'bolletta',
			'luce',
			'energia',
			'elettrica',
			'elettrico',
			'gas',
			'metano',
			'acqua',
			'idrica',
			'telefono',
			'fibra',
			'adsl',
			'internet',
			'tari',
			'imu'
		],
		tags: ['casa']
	},
	{
		categoryName: 'Fiscale',
		keywords: ['f24', 'agenzia entrate', 'iva', 'fiscale'],
		tags: ['fiscale']
	}
];

function normalizeSpaces(value: string) {
	return value.replace(/\s+/g, ' ').trim();
}

function parseDateCandidate(value: string) {
	const numeric = value.match(/\b(\d{4})[-_/](\d{2})[-_/](\d{2})\b/);
	if (numeric) {
		return `${numeric[1]}-${numeric[2]}-${numeric[3]}`;
	}

	const italian = value.match(/\b(\d{2})[-_/](\d{2})[-_/](\d{4})\b/);
	if (italian) {
		return `${italian[3]}-${italian[2]}-${italian[1]}`;
	}

	return undefined;
}

function parseAmountCandidate(value: string) {
	const direct =
		value.match(/(?:totale|importo|amount|total)[^\d]{0,12}(\d{1,4}(?:[.,]\d{2}))/i) ??
		value.match(/(?:\u20AC|eur)\s?(\d{1,4}(?:[.,]\d{2}))/i);

	if (!direct) {
		return undefined;
	}

	const normalized = direct[1].replace(',', '.');
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function inferMerchant(text: string) {
	const lines = text
		.split(/\r?\n/)
		.map((line) => normalizeSpaces(line))
		.filter((line) => line.length >= 3);

	for (const line of lines.slice(0, 6)) {
		if (/\d/.test(line) || /fattura|invoice|receipt|ricevuta|scontrino/i.test(line)) {
			continue;
		}

		return line.slice(0, 64);
	}

	return undefined;
}

function inferCategory(text: string) {
	const lower = text.toLowerCase();

	for (const rule of CATEGORY_RULES) {
		if (rule.keywords.some((keyword) => lower.includes(keyword))) {
			return {
				categoryName: rule.categoryName,
				tags: rule.tags
			};
		}
	}

	return undefined;
}

function inferPaymentStatus(text: string): 'due' | 'paid' | undefined {
	const lower = text.toLowerCase();

	if (
		lower.includes('da pagare') ||
		lower.includes('non pagata') ||
		lower.includes('scadenza pagamento') ||
		lower.includes('payment due')
	) {
		return 'due';
	}

	if (
		lower.includes('pagata') ||
		lower.includes('paid') ||
		lower.includes('saldo ricevuto') ||
		lower.includes('pagamento ricevuto')
	) {
		return 'paid';
	}

	return undefined;
}

function buildSuggestedTitle(params: {
	merchantName?: string;
	documentDate?: string;
	categoryName?: string;
}) {
	const parts = [params.categoryName, params.merchantName, params.documentDate].filter(
		Boolean
	) as string[];

	if (!parts.length) {
		return undefined;
	}

	return normalizeSpaces(parts.join(' - '));
}

function canReadFileText(file: File) {
	return (
		file.type.startsWith('text/') ||
		file.type.includes('json') ||
		file.type.includes('xml') ||
		file.type.includes('csv')
	);
}

function canReadPdfText(file: File) {
	return file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
}

function canRunImageOcr(file: File) {
	return browser && file.type.startsWith('image/');
}

function isMobileBrowser() {
	if (!browser || typeof navigator === 'undefined') {
		return false;
	}

	const userAgent = navigator.userAgent || '';
	return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

async function extractPdfText(file: File) {
	if (!browser || !canReadPdfText(file)) {
		return '';
	}

	try {
		const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
		if (isMobileBrowser()) {
			const fakeWorkerModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
			(globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker =
				fakeWorkerModule;
		} else {
			const workerSrc = (
				await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
			).default;
			pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
		}

		const buffer = await file.arrayBuffer();
		const pdf = await pdfjs.getDocument({ data: buffer }).promise;
		const pagesToRead = Math.min(pdf.numPages, 10);
		const pageTexts: string[] = [];

		for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const textContent = await page.getTextContent();
			const items = textContent.items
				.map((item: any) => ('str' in item ? item.str : ''))
				.filter((value: string) => value.trim());

			if (items.length) {
				pageTexts.push(items.join(' '));
			}
		}

		return normalizeSpaces(pageTexts.join('\n')).slice(0, 12_000);
	} catch (error) {
		console.warn("Impossibile estrarre il testo PDF nell'inbox.", error);
		return '';
	}
}

async function extractImageText(file: File) {
	if (!canRunImageOcr(file)) {
		return '';
	}

	try {
		const { recognize } = await import('tesseract.js');
		const result = await recognize(file, 'ita+eng');
		return normalizeSpaces(result.data.text || '').slice(0, 8_000);
	} catch (error) {
		console.warn("Impossibile completare l'OCR immagine nell'inbox.", error);
		return '';
	}
}

export async function analyzeInboxFile(file: File) {
	let extractedText = '';
	const llmConfigured = hasActiveLocalLlmConfig();

	if (canReadFileText(file)) {
		try {
			extractedText = (await file.text()).slice(0, 8_000);
		} catch {
			extractedText = '';
		}
	}

	if (!extractedText && canReadPdfText(file)) {
		extractedText = await extractPdfText(file);
	}

	if (
		!extractedText &&
		canRunImageOcr(file) &&
		(!llmConfigured || file.size > OPENAI_DIRECT_IMAGE_BYTES_LIMIT)
	) {
		extractedText = await extractImageText(file);
	}

	const analysisSource = normalizeSpaces(extractedText);
	const category = analysisSource ? inferCategory(analysisSource) : undefined;
	const extractedDocumentDate = analysisSource ? parseDateCandidate(analysisSource) : undefined;
	const extractedAmount = analysisSource ? parseAmountCandidate(analysisSource) : undefined;
	const extractedMerchantName = analysisSource ? inferMerchant(analysisSource) : undefined;
	const extractedPaymentStatus = analysisSource
		? inferPaymentStatus(analysisSource)
		: undefined;

	const suggestedTags = Array.from(
		new Set([
			...(category?.tags ?? []),
			...(file.type.includes('pdf') ? ['pdf'] : []),
			...(file.type.startsWith('image/') ? ['immagine'] : [])
		])
	);

	const suggestedTitle = buildSuggestedTitle({
		merchantName: extractedMerchantName,
		documentDate: extractedDocumentDate,
		categoryName: category?.categoryName
	});

	const analysisStatus: InboxAnalysisStatus =
		extractedText ||
		category?.categoryName ||
		extractedDocumentDate ||
		extractedMerchantName ||
		typeof extractedAmount === 'number'
			? 'completed'
			: 'idle';

	const heuristicResult = {
		analysisStatus,
		ocrText: extractedText || undefined,
		suggestedTitle,
		suggestedCategoryName: category?.categoryName,
		suggestedTags,
		extractedPayloadJson: JSON.stringify({
			provider: 'heuristic',
			fileName: file.name,
			fileType: file.type,
			extractedDocumentDate,
			extractedMerchantName,
			extractedAmount,
			extractedPaymentStatus,
			suggestedCategoryName: category?.categoryName,
			suggestedTags
		}),
		extractedDocumentDate,
		extractedMerchantName,
		extractedAmount,
		extractedPaymentStatus
	} satisfies InboxAnalysisResult;

	if (!llmConfigured) {
		return heuristicResult;
	}

	try {
		const llmResult = await runOpenAiInboxAnalysis({
			file,
			extractedText: extractedText || undefined,
			heuristic: heuristicResult
		});

		return llmResult ?? heuristicResult;
	} catch (error) {
		console.warn("Impossibile completare l'analisi OpenAI del documento inbox.", error);
		return heuristicResult;
	}
}
