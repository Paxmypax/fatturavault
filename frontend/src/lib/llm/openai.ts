import type { InboxAnalysisResult } from '$lib/inboxAnalysis';
import { DEFAULT_OPENAI_MODEL, getLocalLlmConfig } from '$lib/llm/config';

const PDF_FILE_INPUT_FALLBACK_MODEL = 'gpt-4o-mini';
const PDF_FILE_INPUT_COMPATIBLE_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'o1']);

type OpenAiInboxAnalysis = {
	title: string | null;
	category_name: string | null;
	tags: string[];
	document_date: string | null;
	merchant_name: string | null;
	amount: number | null;
	payment_status: 'due' | 'paid' | null;
	document_text_excerpt: string | null;
	invoice_data: {
		invoice_type: 'ricevuta' | 'emessa' | null;
		invoice_number: string | null;
		supplier: string | null;
		vat_number: string | null;
		net_amount: number | null;
		vat_rate: number | null;
		vat_amount: number | null;
		total_amount: number | null;
		line_items: Array<{
			description: string;
			amount: number | null;
			vat_rate: number | null;
		}>;
	} | null;
};

const ANALYSIS_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		title: {
			type: ['string', 'null']
		},
		category_name: {
			type: ['string', 'null']
		},
		tags: {
			type: 'array',
			items: {
				type: 'string'
			}
		},
		document_date: {
			type: ['string', 'null']
		},
		merchant_name: {
			type: ['string', 'null']
		},
		amount: {
			type: ['number', 'null']
		},
		payment_status: {
			type: ['string', 'null'],
			enum: ['due', 'paid', null]
		},
		document_text_excerpt: {
			type: ['string', 'null']
		},
		invoice_data: {
			type: ['object', 'null'],
			additionalProperties: false,
			properties: {
				invoice_type: {
					type: ['string', 'null'],
					enum: ['ricevuta', 'emessa', null]
				},
				invoice_number: {
					type: ['string', 'null']
				},
				supplier: {
					type: ['string', 'null']
				},
				vat_number: {
					type: ['string', 'null']
				},
				net_amount: {
					type: ['number', 'null']
				},
				vat_rate: {
					type: ['number', 'null']
				},
				vat_amount: {
					type: ['number', 'null']
				},
				total_amount: {
					type: ['number', 'null']
				},
				line_items: {
					type: 'array',
					items: {
						type: 'object',
						additionalProperties: false,
						properties: {
							description: {
								type: 'string'
							},
							amount: {
								type: ['number', 'null']
							},
							vat_rate: {
								type: ['number', 'null']
							}
						},
						required: ['description', 'amount', 'vat_rate']
					}
				}
			},
			required: [
				'invoice_type',
				'invoice_number',
				'supplier',
				'vat_number',
				'net_amount',
				'vat_rate',
				'vat_amount',
				'total_amount',
				'line_items'
			]
		}
	},
	required: [
		'title',
		'category_name',
		'tags',
		'document_date',
		'merchant_name',
		'amount',
		'payment_status',
		'document_text_excerpt',
		'invoice_data'
	]
} as const;

function normalizeSpaces(value: string) {
	return value.replace(/\s+/g, ' ').trim();
}

function limitText(value: string | undefined, maxLength = 5_000) {
	if (!value) {
		return undefined;
	}

	return value.slice(0, maxLength);
}

function sanitizeDate(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return trimmed;
	}

	return undefined;
}

function sanitizeTags(tags: string[] | null | undefined) {
	if (!Array.isArray(tags)) {
		return [];
	}

	return Array.from(
		new Set(
			tags
				.map((tag) => normalizeSpaces(tag))
				.filter((tag) => tag.length >= 2)
				.map((tag) => tag.toLowerCase())
		)
	).slice(0, 8);
}

function sanitizeOptionalText(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	const trimmed = normalizeSpaces(value);
	return trimmed || undefined;
}

function extractOutputText(payload: any) {
	if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
		return payload.output_text;
	}

	const segments =
		payload?.output
			?.flatMap((item: any) => item?.content ?? [])
			?.map((content: any) => content?.text ?? content?.value ?? '')
			?.filter((value: unknown) => typeof value === 'string' && value.trim()) ?? [];

	return segments.length ? segments.join('\n') : '';
}

function parseStructuredOutput(payload: any): OpenAiInboxAnalysis | null {
	const rawText = extractOutputText(payload);
	if (!rawText) {
		return null;
	}

	try {
		const parsed = JSON.parse(rawText) as OpenAiInboxAnalysis;
		if (!parsed || typeof parsed !== 'object') {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

function fileToDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error('Impossibile leggere il file.'));
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
				return;
			}

			reject(new Error('Formato file non supportato.'));
		};
		reader.readAsDataURL(file);
	});
}

async function fileToBase64(file: File) {
	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = '';

	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		const chunk = bytes.subarray(offset, offset + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return btoa(binary);
}

async function fileToDataBase64Url(file: File) {
	const base64 = await fileToBase64(file);
	const mimeType = file.type || 'application/octet-stream';
	return `data:${mimeType};base64,${base64}`;
}

function detectInputKind(input: { file: File; extractedText?: string }) {
	if (input.file.type.startsWith('image/')) {
		return input.extractedText ? 'image+text' : 'image';
	}

	if (input.file.type.includes('pdf') || input.file.name.toLowerCase().endsWith('.pdf')) {
		return input.extractedText ? 'pdf+text' : 'pdf';
	}

	return input.extractedText ? 'text' : 'file';
}

export async function runOpenAiInboxAnalysis(input: {
	file: File;
	extractedText?: string;
	heuristic: InboxAnalysisResult;
}) {
	const config = getLocalLlmConfig();
	if (!config?.enabled || !config.apiKey) {
		return null;
	}

	const inputKind = detectInputKind(input);
	const requestedModel = config.model || DEFAULT_OPENAI_MODEL;
	const content: Array<Record<string, unknown>> = [
		{
			type: 'input_text',
			text: [
				'Analizza un documento amministrativo o fiscale caricato in una inbox temporanea.',
				'Non inventare dati. Se un campo non è chiaramente leggibile, restituisci null o array vuoto.',
				'Non derivare merchant, importo o data solo dal nome file se non sono confermati dal contenuto.',
				'Usa solo queste categorie quando pertinenti: Fattura, Ricevuta, Garanzia, Assicurazione, Auto, Abbonamento, Casa, Fiscale, Altro.',
				'Classifica come Casa le bollette e le utenze domestiche, per esempio luce, energia elettrica, gas, acqua, internet casa, telefono fisso, fibra, condominio, TARI o IMU.',
				'Se il documento è una bolletta o fattura di utenza domestica, la categoria preferita è Casa anche se nel documento compaiono parole come fattura o invoice.',
				'Se il documento è una fattura o una ricevuta fiscale, compila anche invoice_data.',
				'Per invoice_type usa "emessa" solo se è chiaramente una fattura emessa dall’utente; altrimenti usa "ricevuta" per fatture/ricevute ricevute.',
				'Restituisci solo il JSON richiesto.',
				'',
				`Nome file: ${input.file.name}`,
				`Mime type: ${input.file.type || 'application/octet-stream'}`,
				`Tipo input disponibile: ${inputKind}`,
				input.heuristic.suggestedCategoryName
					? `Categoria euristica già trovata: ${input.heuristic.suggestedCategoryName}`
					: '',
				input.heuristic.extractedMerchantName
					? `Merchant euristico già trovato: ${input.heuristic.extractedMerchantName}`
					: '',
				typeof input.heuristic.extractedAmount === 'number'
					? `Importo euristico già trovato: ${input.heuristic.extractedAmount}`
					: '',
				input.heuristic.extractedDocumentDate
					? `Data euristica già trovata: ${input.heuristic.extractedDocumentDate}`
					: '',
				input.extractedText
					? `Testo preliminare disponibile:\n${limitText(input.extractedText)}`
					: 'Non c’è testo preliminare disponibile.'
			]
				.filter(Boolean)
				.join('\n')
		}
	];

	const canAttachPdf =
		input.file.type.includes('pdf') || input.file.name.toLowerCase().endsWith('.pdf');

	if (canAttachPdf) {
		try {
			const fileData = await fileToDataBase64Url(input.file);
			content.push({
				type: 'input_file',
				filename: input.file.name,
				file_data: fileData
			});
		} catch (error) {
			console.warn("Impossibile preparare il PDF per l'analisi OpenAI.", error);
		}
	}

	if (input.file.type.startsWith('image/') && input.file.size <= 4_000_000) {
		try {
			const imageUrl = await fileToDataUrl(input.file);
			content.push({
				type: 'input_image',
				image_url: imageUrl
			});
		} catch (error) {
			console.warn("Impossibile preparare l'immagine per l'analisi OpenAI.", error);
		}
	}

	if (content.length === 1 && !input.extractedText) {
		return null;
	}

	const modelForRequest =
		canAttachPdf && !input.extractedText && !PDF_FILE_INPUT_COMPATIBLE_MODELS.has(requestedModel)
			? PDF_FILE_INPUT_FALLBACK_MODEL
			: requestedModel;

	const requestBody = {
		model: modelForRequest,
		store: false,
		input: [
			{
				role: 'user',
				content
			}
		],
		text: {
			format: {
				type: 'json_schema',
				name: 'fatturavault_inbox_analysis',
				strict: true,
				schema: ANALYSIS_SCHEMA
			}
		}
	};

	let response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.apiKey}`
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok && canAttachPdf) {
		const fallbackContent = content.filter((entry) => entry.type !== 'input_file');
		if (fallbackContent.length && input.extractedText) {
			response = await fetch('https://api.openai.com/v1/responses', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${config.apiKey}`
				},
				body: JSON.stringify({
					...requestBody,
					input: [
						{
							role: 'user',
							content: fallbackContent
						}
					]
				})
			});
		}
	}

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`OpenAI Responses API ${response.status}: ${errorBody.slice(0, 400)}`);
	}

	const payload = await response.json();
	const parsed = parseStructuredOutput(payload);
	if (!parsed) {
		return null;
	}

	const finalTags = sanitizeTags([...(input.heuristic.suggestedTags ?? []), ...parsed.tags]);
	const finalOcrText = limitText(parsed.document_text_excerpt || input.extractedText, 8_000);
	const finalCategoryName =
		typeof parsed.category_name === 'string' && parsed.category_name.trim()
			? normalizeSpaces(parsed.category_name)
			: input.heuristic.suggestedCategoryName;
	const finalTitle =
		typeof parsed.title === 'string' && parsed.title.trim()
			? normalizeSpaces(parsed.title)
			: input.heuristic.suggestedTitle;
	const finalMerchant =
		typeof parsed.merchant_name === 'string' && parsed.merchant_name.trim()
			? normalizeSpaces(parsed.merchant_name)
			: input.heuristic.extractedMerchantName;
	const finalAmount =
		typeof parsed.amount === 'number' && Number.isFinite(parsed.amount)
			? parsed.amount
			: input.heuristic.extractedAmount;
	const finalDate = sanitizeDate(parsed.document_date) || input.heuristic.extractedDocumentDate;
	const finalPaymentStatus = parsed.payment_status || input.heuristic.extractedPaymentStatus;
	const invoiceData =
		parsed.invoice_data &&
		(finalCategoryName === 'Fattura' || finalCategoryName === 'Ricevuta' || finalCategoryName === 'Fiscale')
			? {
					invoiceType:
						parsed.invoice_data.invoice_type === 'emessa' ? 'emessa' : 'ricevuta',
					invoiceNumber: sanitizeOptionalText(parsed.invoice_data.invoice_number),
					supplier: sanitizeOptionalText(parsed.invoice_data.supplier) || finalMerchant,
					vatNumber: sanitizeOptionalText(parsed.invoice_data.vat_number),
					netAmount:
						typeof parsed.invoice_data.net_amount === 'number' &&
						Number.isFinite(parsed.invoice_data.net_amount)
							? parsed.invoice_data.net_amount
							: undefined,
					vatRate:
						typeof parsed.invoice_data.vat_rate === 'number' &&
						Number.isFinite(parsed.invoice_data.vat_rate)
							? parsed.invoice_data.vat_rate
							: undefined,
					vatAmount:
						typeof parsed.invoice_data.vat_amount === 'number' &&
						Number.isFinite(parsed.invoice_data.vat_amount)
							? parsed.invoice_data.vat_amount
							: undefined,
					totalAmount:
						typeof parsed.invoice_data.total_amount === 'number' &&
						Number.isFinite(parsed.invoice_data.total_amount)
							? parsed.invoice_data.total_amount
							: undefined,
					lineItems: Array.isArray(parsed.invoice_data.line_items)
						? parsed.invoice_data.line_items
								.filter((item) => sanitizeOptionalText(item.description))
								.map((item) => ({
									description: sanitizeOptionalText(item.description) || '',
									amount:
										typeof item.amount === 'number' && Number.isFinite(item.amount)
											? item.amount
											: 0,
									vatRate:
										typeof item.vat_rate === 'number' && Number.isFinite(item.vat_rate)
											? item.vat_rate
											: 22
								}))
						: []
				}
			: undefined;

	return {
		analysisStatus:
			finalOcrText ||
			finalCategoryName ||
			finalTitle ||
			finalMerchant ||
			finalDate ||
			typeof finalAmount === 'number'
				? 'completed'
				: 'idle',
		ocrText: finalOcrText,
		suggestedTitle: finalTitle,
		suggestedCategoryName: finalCategoryName,
		suggestedTags: finalTags,
		extractedPayloadJson: JSON.stringify({
			provider: 'openai',
			model: modelForRequest,
			inputKind,
			title: finalTitle,
			categoryName: finalCategoryName,
			tags: finalTags,
			documentDate: finalDate,
			merchantName: finalMerchant,
			amount: finalAmount,
			paymentStatus: finalPaymentStatus,
			invoiceData
		}),
		extractedDocumentDate: finalDate,
		extractedMerchantName: finalMerchant,
		extractedAmount: finalAmount,
		extractedPaymentStatus: finalPaymentStatus ?? undefined
	} satisfies InboxAnalysisResult;
}
