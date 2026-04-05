$ErrorActionPreference = 'Stop'

$environmentName = 'ic'
$identityName = 'fatturavault-staging'
$warningThreshold = 300000000000
$criticalThreshold = 150000000000

$canisters = @(
	@{ name = 'frontend'; id = 'sa6ad-byaaa-aaaas-qge3a-cai' },
	@{ name = 'vault_backend'; id = 'sj5l7-xqaaa-aaaas-qge2q-cai' },
	@{ name = 'vault_storage'; id = 'cd6pz-eqaaa-aaaac-bekmq-cai' },
	@{ name = 'vault_analytics'; id = 'ap74x-uaaaa-aaaaa-qgyra-cai' },
	@{ name = 'vault_inbox'; id = 'gfi4d-wiaaa-aaaab-qgrma-cai' }
)

function Invoke-Icp {
	param(
		[Parameter(Mandatory = $true)]
		[string[]]$Arguments
	)

	$output = & icp @Arguments 2>&1
	if ($LASTEXITCODE -ne 0) {
		throw ($output -join [Environment]::NewLine)
	}

	return $output
}

function Get-FieldValue {
	param(
		[string[]]$Lines,
		[string]$Label
	)

	$prefix = "${Label}:"
	foreach ($line in $Lines) {
		$trimmed = $line.Trim()
		if ($trimmed.StartsWith($prefix)) {
			return $trimmed.Substring($prefix.Length).Trim()
		}
	}

	return $null
}

function Get-CyclesValue {
	param(
		[string[]]$Lines
	)

	$raw = Get-FieldValue -Lines $Lines -Label 'Cycles'
	if (-not $raw) {
		return $null
	}

	$digits = ($raw -replace '[^0-9]', '')
	if (-not $digits) {
		return $null
	}

	return [Int64]$digits
}

function Get-Level {
	param(
		[Nullable[Int64]]$Cycles
	)

	if ($null -eq $Cycles) {
		return 'sconosciuto'
	}

	if ($Cycles -lt $criticalThreshold) {
		return 'basso'
	}

	if ($Cycles -lt $warningThreshold) {
		return 'attenzione'
	}

	return 'ok'
}

function Format-Cycles {
	param(
		[Nullable[Int64]]$Cycles
	)

	if ($null -eq $Cycles) {
		return '-'
	}

	return ('{0:N0}' -f $Cycles).Replace(',', '_')
}

$principal = (Invoke-Icp -Arguments @('identity', 'principal', '--identity', $identityName) | Select-Object -First 1).Trim()

Write-Host "Principal corrente: $principal"
Write-Host "Identita CLI: $identityName"
Write-Host "Ambiente: $environmentName"
Write-Host ''

$hasCritical = $false

foreach ($canister in $canisters) {
	try {
		$statusLines = Invoke-Icp -Arguments @(
			'canister',
			'status',
			$canister.id,
			'-e',
			$environmentName,
			'--identity',
			$identityName
		)

		$status = Get-FieldValue -Lines $statusLines -Label 'Status'
		$cycles = Get-CyclesValue -Lines $statusLines
		$memorySize = Get-FieldValue -Lines $statusLines -Label 'Memory size'
		$idleBurn = Get-FieldValue -Lines $statusLines -Label 'Idle cycles burned per day'
		$level = Get-Level -Cycles $cycles

		if ($level -eq 'basso') {
			$hasCritical = $true
		}

		Write-Host "[$($level.ToUpper())] $($canister.name)"
		Write-Host "  id: $($canister.id)"
		Write-Host "  status: $(if ($status) { $status } else { '-' })"
		Write-Host "  cycles: $(Format-Cycles -Cycles $cycles)"
		Write-Host "  memoria: $(if ($memorySize) { $memorySize } else { '-' })"
		Write-Host "  burn/giorno: $(if ($idleBurn) { $idleBurn } else { '-' })"
		Write-Host ''
	} catch {
		$hasCritical = $true
		Write-Host "[ERRORE] $($canister.name)"
		Write-Host "  id: $($canister.id)"
		Write-Host "  dettaglio: $($_.Exception.Message.Trim())"
		Write-Host ''
	}
}

Write-Host "Soglie: attenzione sotto $(Format-Cycles -Cycles $warningThreshold) cycles, basso sotto $(Format-Cycles -Cycles $criticalThreshold) cycles."

if ($hasCritical) {
	exit 1
}
