export type VatUploadKind = 'issued' | 'received' | 'receipts';

export type VatBreakdownRow = {
	rateLabel: string;
	taxable: number;
	vat: number;
};

export type VatCsvComputation = {
	filesCount: number;
	fileNames: string[];
	totalBytes: number;
	totalRows: number;
	recognizedRows: number;
	skippedRows: number;
	taxable: number;
	vat: number;
	gross: number;
	breakdown: VatBreakdownRow[];
	issues: string[];
};

type CsvRecord = Record<string, string>;

const KNOWN_VAT_RATES = [4, 5, 10, 22];

function normalizeHeader(value: string) {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]/g, '');
}

function parseNumber(value: string | null | undefined) {
	if (value === null || value === undefined || value === '') {
		return 0;
	}

	let normalized = String(value).trim().replace(/[EUR\s]/gi, '').replace(/[^\d,.-]/g, '');

	if (normalized.includes(',') && normalized.includes('.')) {
		if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
			normalized = normalized.replace(/\./g, '').replace(',', '.');
		} else {
			normalized = normalized.replace(/,/g, '');
		}
	} else if (normalized.includes(',')) {
		normalized = normalized.replace(',', '.');
	}

	const parsed = Number.parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
}

function detectCSVSeparator(text: string) {
	const firstLine = text.split(/\r?\n/)[0] ?? '';
	const semicolons = (firstLine.match(/;/g) || []).length;
	const commas = (firstLine.match(/,/g) || []).length;
	const tabs = (firstLine.match(/\t/g) || []).length;

	if (tabs >= semicolons && tabs >= commas && tabs > 0) {
		return '\t';
	}

	if (semicolons >= commas) {
		return ';';
	}

	return ',';
}

function splitCsvLine(line: string, separator: string) {
	const parts: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		const nextCharacter = line[index + 1];

		if (character === '"') {
			if (inQuotes && nextCharacter === '"') {
				current += '"';
				index += 1;
				continue;
			}

			inQuotes = !inQuotes;
			continue;
		}

		if (!inQuotes && character === separator) {
			parts.push(current.trim());
			current = '';
			continue;
		}

		current += character;
	}

	parts.push(current.trim());
	return parts.map((value) => value.replace(/^"|"$/g, ''));
}

function parseCSV(text: string): CsvRecord[] {
	const separator = detectCSVSeparator(text);
	const lines = text
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length < 2) {
		return [];
	}

	const headers = splitCsvLine(lines[0], separator).map((header) => header.toLowerCase());

	return lines.slice(1).map((line) => {
		const values = splitCsvLine(line, separator);
		const record: CsvRecord = {};
		headers.forEach((header, index) => {
			record[header] = values[index] ?? '';
		});
		return record;
	});
}

function findColumn(row: CsvRecord, keywords: string[]) {
	const keys = Object.keys(row);

	for (const keyword of keywords) {
		const normalizedKeyword = normalizeHeader(keyword);
		const found = keys.find((key) => normalizeHeader(key).includes(normalizedKeyword));
		if (found) {
			return found;
		}
	}

	return null;
}

function closestVatRate(percentage: number) {
	return KNOWN_VAT_RATES.reduce((left, right) =>
		Math.abs(right - percentage) < Math.abs(left - percentage) ? right : left
	);
}

function accumulateBreakdown(
	target: Map<string, VatBreakdownRow>,
	rate: number | null,
	taxable: number,
	vat: number
) {
	const label =
		rate === null
			? 'Aliquota non indicata'
			: `${rate.toFixed(Number.isInteger(rate) ? 0 : 2)}%`;
	const current = target.get(label) ?? {
		rateLabel: label,
		taxable: 0,
		vat: 0
	};

	current.taxable += taxable;
	current.vat += vat;
	target.set(label, current);
}

function extractIVAFromFatture(rows: CsvRecord[]) {
	let totalTaxable = 0;
	let totalVat = 0;
	let totalGross = 0;
	let recognizedRows = 0;
	let skippedRows = 0;
	const breakdown = new Map<string, VatBreakdownRow>();

	rows.forEach((row) => {
		const taxableColumn = findColumn(row, [
			'imponibile',
			'base imponibile',
			'importo imponibile',
			'netto'
		]);
		const vatColumn = findColumn(row, ['imposta', 'iva', 'importo iva', 'importo imposta']);
		const grossColumn = findColumn(row, [
			'totale documento',
			'totale',
			'importo totale',
			'totale fattura'
		]);
		const rateColumn = findColumn(row, ['aliquota', '% iva', 'percentuale', 'aliquota iva']);

		const taxable = taxableColumn ? parseNumber(row[taxableColumn]) : 0;
		const vat = vatColumn ? parseNumber(row[vatColumn]) : 0;
		const gross = grossColumn ? parseNumber(row[grossColumn]) : 0;
		const rate = rateColumn ? parseNumber(row[rateColumn]) : 0;

		if (!taxable && !vat && !gross) {
			skippedRows += 1;
			return;
		}

		recognizedRows += 1;
		totalTaxable += taxable;
		totalVat += vat;
		totalGross += gross || taxable + vat;

		let effectiveRate: number | null = null;
		if (rate > 0) {
			effectiveRate = rate;
		} else if (vat > 0 && taxable > 0) {
			effectiveRate = closestVatRate(Math.round((vat / taxable) * 100));
		}

		accumulateBreakdown(breakdown, effectiveRate, taxable, vat);
	});

	return {
		taxable: totalTaxable,
		vat: totalVat,
		gross: totalGross,
		recognizedRows,
		skippedRows,
		breakdown
	};
}

function extractIVAFromCorrispettivi(rows: CsvRecord[]) {
	let totalTaxable = 0;
	let totalVat = 0;
	let totalGross = 0;
	let recognizedRows = 0;
	let skippedRows = 0;
	const breakdown = new Map<string, VatBreakdownRow>();

	rows.forEach((row) => {
		const grossColumn = findColumn(row, ['corrispettivo', 'ammontare', 'importo', 'totale']);
		const vatColumn = findColumn(row, ['imposta', 'iva', 'importo iva', 'importo imposta']);
		const taxableColumn = findColumn(row, ['imponibile', 'base imponibile']);
		const rateColumn = findColumn(row, ['aliquota', '% iva', 'percentuale']);

		const gross = grossColumn ? parseNumber(row[grossColumn]) : 0;
		const vat = vatColumn ? parseNumber(row[vatColumn]) : 0;
		const taxable = taxableColumn ? parseNumber(row[taxableColumn]) : 0;
		const rate = rateColumn ? parseNumber(row[rateColumn]) : 0;

		let effectiveTaxable = taxable;
		let effectiveVat = vat;

		if (effectiveTaxable === 0 && gross > 0 && rate > 0) {
			effectiveTaxable = gross / (1 + rate / 100);
			effectiveVat = gross - effectiveTaxable;
		} else if (effectiveTaxable === 0 && gross > 0 && effectiveVat > 0) {
			effectiveTaxable = gross - effectiveVat;
		}

		if (!effectiveTaxable && !effectiveVat && !gross) {
			skippedRows += 1;
			return;
		}

		recognizedRows += 1;
		totalTaxable += effectiveTaxable;
		totalVat += effectiveVat;
		totalGross += gross || effectiveTaxable + effectiveVat;

		let effectiveRate: number | null = null;
		if (rate > 0) {
			effectiveRate = rate;
		} else if (effectiveVat > 0 && effectiveTaxable > 0) {
			effectiveRate = closestVatRate(Math.round((effectiveVat / effectiveTaxable) * 100));
		}

		accumulateBreakdown(breakdown, effectiveRate, effectiveTaxable, effectiveVat);
	});

	return {
		taxable: totalTaxable,
		vat: totalVat,
		gross: totalGross,
		recognizedRows,
		skippedRows,
		breakdown
	};
}

export function formatEuro(value: number) {
	return new Intl.NumberFormat('it-IT', {
		style: 'currency',
		currency: 'EUR'
	}).format(value);
}

export async function computeVatCsv(files: File[], kind: VatUploadKind): Promise<VatCsvComputation> {
	const issues: string[] = [];
	const allRows: CsvRecord[] = [];

	for (const file of files) {
		const text = await file.text();
		const rows = parseCSV(text);
		if (!rows.length) {
			issues.push(`${file.name}: nessuna riga utile trovata nel CSV.`);
			continue;
		}

		allRows.push(...rows);
	}

	let result: ReturnType<typeof extractIVAFromFatture> | ReturnType<typeof extractIVAFromCorrispettivi>;
	if (kind === 'receipts') {
		result = extractIVAFromCorrispettivi(allRows);
	} else {
		result = extractIVAFromFatture(allRows);
	}

	if (result.recognizedRows === 0 && files.length > 0) {
		issues.push(
			kind === 'receipts'
				? 'Nessuna riga utile riconosciuta nei CSV dei corrispettivi.'
				: 'Nessuna riga utile riconosciuta nei CSV delle fatture.'
		);
	}

	return {
		filesCount: files.length,
		fileNames: files.map((file) => file.name),
		totalBytes: files.reduce((sum, file) => sum + file.size, 0),
		totalRows: allRows.length,
		recognizedRows: result.recognizedRows,
		skippedRows: result.skippedRows,
		taxable: result.taxable,
		vat: result.vat,
		gross: result.gross,
		breakdown: [...result.breakdown.values()].sort((left, right) =>
			left.rateLabel.localeCompare(right.rateLabel)
		),
		issues
	};
}
