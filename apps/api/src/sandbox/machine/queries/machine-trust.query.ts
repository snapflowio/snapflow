/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	BillingAdjustmentReasonCode,
	BillingEvidenceStatus,
	BillingLineSourceType,
} from '../../../billing/ledger/constants/billing.constants';
import { BillingAuditFaultDomain } from '../../../billing/ledger/constants/billing-audit.constants';
import { MACHINE_TRUST_POLICY } from '../../../billing/ledger/constants/machine-trust.constants';
import {
	MACHINE_ATTRIBUTION_SUBJECT,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SOURCE,
	MACHINE_WORKLOAD_OUTCOME_CLASS,
} from '../constants/machine-reliability.constants';
import { MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS } from '../constants/machine-usage.constants';
import type {
	MachineAttestationMass,
	MachineOutcomeMass,
	MachineTrustEvidence,
} from '../utils/qualification/machine-trust-evaluation.util';
import {
	EVIDENCE_WINDOW_START_SQL,
	evidenceWeightSql,
	machineHostSql,
} from './machine-evidence-weight.query';

interface MachineEvidenceCounts {
	successful: number;
	machineFailures: number;
	unattributedFailures: number;
	neutral: number;
	platformObserved: number;
	fraudulentLines: number;
	reconciledWindows: number;
}

export interface MachineTrustTally {
	window: MachineTrustEvidence;
	recent: MachineTrustEvidence;
	counts: MachineEvidenceCounts;
	recentFraudulentLines: number;
	recentPlatformSuccesses: number;
}

const { SUCCESS, FAILURE, UNATTRIBUTED, NEUTRAL } = MACHINE_RELIABILITY_OUTCOME;
const { PLATFORM, MACHINE } = MACHINE_RELIABILITY_SOURCE;
const { WORKLOAD: WORKLOAD_SUBJECT, CUSTOMER: CUSTOMER_SUBJECT } =
	MACHINE_ATTRIBUTION_SUBJECT;

const OUTCOME_SQL = `WITH subject AS (
		SELECT ${machineHostSql('machine')} AS host FROM machine WHERE machine.id = ?
	),
	evidence AS (
		SELECT event.outcome, event.source, event."workloadFingerprint" AS fingerprint,
			event."customerOrganizationId"::text AS customer,
			event."placementId" AS placement_id, event."observedAt" AS observed_at
		FROM machine_reliability_event event
		WHERE event."machineId" = ? AND event."observedAt" >= ${EVIDENCE_WINDOW_START_SQL}
			AND NOT event."selfDealt"
	),
	failed_subjects AS (
		SELECT DISTINCT '${WORKLOAD_SUBJECT}' AS kind, fingerprint AS subject FROM evidence
		WHERE fingerprint IS NOT NULL AND outcome <> '${SUCCESS}'
		UNION
		SELECT DISTINCT '${CUSTOMER_SUBJECT}', customer FROM evidence
		WHERE customer IS NOT NULL AND outcome <> '${SUCCESS}'
	),
	peers AS (
		SELECT outcome."subjectKind" AS kind, outcome.subject,
			COUNT(*) FILTER (WHERE outcome."outcomeClass" = '${MACHINE_WORKLOAD_OUTCOME_CLASS.FAILURE}') AS failing,
			COUNT(*) FILTER (WHERE outcome."outcomeClass" = '${MACHINE_WORKLOAD_OUTCOME_CLASS.SUCCESS}') AS succeeding
		FROM failed_subjects
		JOIN machine_workload_outcome outcome
			ON outcome."subjectKind" = failed_subjects.kind AND outcome.subject = failed_subjects.subject
		CROSS JOIN subject
		WHERE outcome."lastObservedAt" >= ${EVIDENCE_WINDOW_START_SQL}
			AND outcome.host <> subject.host
		GROUP BY outcome."subjectKind", outcome.subject
	),
	attributed AS (
		SELECT evidence.source, evidence.placement_id, evidence.observed_at,
			CASE
				WHEN evidence.outcome = '${SUCCESS}' THEN '${SUCCESS}'
				WHEN (COALESCE(workload.failing, 0) > 0 AND workload.failing >= COALESCE(workload.succeeding, 0))
					OR (COALESCE(customer.failing, 0) > 0 AND customer.failing >= COALESCE(customer.succeeding, 0)) THEN '${NEUTRAL}'
				WHEN evidence.source = '${PLATFORM}' THEN '${FAILURE}'
				WHEN COALESCE(workload.succeeding, 0) > COALESCE(workload.failing, 0) THEN '${FAILURE}'
				ELSE evidence.outcome
			END AS kind
		FROM evidence
		LEFT JOIN peers workload ON workload.kind = '${WORKLOAD_SUBJECT}' AND workload.subject = evidence.fingerprint
		LEFT JOIN peers customer ON customer.kind = '${CUSTOMER_SUBJECT}' AND customer.subject = evidence.customer
	)
	SELECT kind, source, observed_at >= ?::timestamptz AS recent,
		SUM(${evidenceWeightSql('observed_at')}) AS mass, COUNT(*) AS count,
		COUNT(DISTINCT placement_id) AS placements
	FROM attributed
	GROUP BY kind, source, recent`;

const ATTESTATION_SQL = `WITH failures AS MATERIALIZED (
		SELECT event."placementId" AS placement_id, event."observedAt" AS observed_at
		FROM machine_reliability_event event
		WHERE event."machineId" = ? AND event.outcome = '${FAILURE}' AND event."placementId" IS NOT NULL
	)
	SELECT line."reconciledAt" >= ?::timestamptz AS recent,
		SUM(${evidenceWeightSql('line."reconciledAt"')}) AS mass,
		SUM(${evidenceWeightSql('line."reconciledAt"')} * line."grossMicroUsd"::double precision) AS intended,
		SUM(${evidenceWeightSql('line."reconciledAt"')} * COALESCE(shortfall.amount, 0)::double precision) AS unattested,
		COUNT(*) AS count
	FROM billing_line_item line
	LEFT JOIN LATERAL (
		SELECT SUM(adjustment."amountMicroUsd") AS amount
		FROM billing_line_adjustment adjustment
		WHERE adjustment."lineItemId" = line.id AND adjustment."reasonCode" = ?
	) shortfall ON true
	WHERE line."machineId" = ?
		AND line."evidenceStatus" = ?
		AND line."sourceType" = ?
		AND line."reconciledAt" >= ${EVIDENCE_WINDOW_START_SQL}
		AND NOT EXISTS (
			SELECT 1 FROM failures
			WHERE failures.placement_id = line."placementId"
				AND failures.observed_at >= line."periodStart"
				AND failures.observed_at < line."periodEnd" + (? * interval '1 millisecond')
		)
	GROUP BY recent`;

const FRAUD_SQL = `SELECT line."periodEnd" >= ?::timestamptz AS recent, COUNT(*) AS count
	FROM billing_line_quarantine quarantine
	JOIN billing_line_item line ON line.id = quarantine."lineItemId"
	WHERE quarantine."machineId" = ? AND quarantine."faultDomain" = ?
		AND line."periodEnd" >= ${EVIDENCE_WINDOW_START_SQL}
	GROUP BY recent`;

interface OutcomeRow {
	kind: string;
	source: string;
	recent: boolean;
	mass: string | null;
	count: string;
	placements: string;
}

interface AttestationRow {
	recent: boolean;
	mass: string | null;
	intended: string | null;
	unattested: string | null;
	count: string;
}

interface CountRow {
	recent: boolean;
	count: string;
}

export async function machineTrustTally(
	manager: EntityManager,
	machineId: string,
	recentStartedAt: Date
): Promise<MachineTrustTally> {
	const outcomeRows = await manager.execute<OutcomeRow[]>(OUTCOME_SQL, [
		machineId,
		machineId,
		recentStartedAt,
	]);
	const attestationRows = await manager.execute<AttestationRow[]>(
		ATTESTATION_SQL,
		[
			machineId,
			recentStartedAt,
			BillingAdjustmentReasonCode.USAGE_ATTESTATION_SHORTFALL,
			machineId,
			BillingEvidenceStatus.CORROBORATED,
			BillingLineSourceType.SANDBOX_USAGE_PERIOD,
			MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS,
		]
	);
	const fraudRows = await manager.execute<CountRow[]>(FRAUD_SQL, [
		recentStartedAt,
		machineId,
		BillingAuditFaultDomain.MACHINE,
	]);
	const recentOutcomes = outcomeRows.filter(({ recent }) => recent);
	return {
		window: {
			outcomes: outcomeMass(outcomeRows),
			attestation: attestationMass(attestationRows),
		},
		recent: {
			outcomes: outcomeMass(recentOutcomes),
			attestation: attestationMass(
				attestationRows.filter(({ recent }) => recent)
			),
		},
		counts: {
			successful: sumOf(outcomeRows, 'count', SUCCESS),
			machineFailures: sumOf(outcomeRows, 'count', FAILURE),
			unattributedFailures: sumOf(outcomeRows, 'count', UNATTRIBUTED),
			neutral: sumOf(outcomeRows, 'count', NEUTRAL),
			platformObserved: outcomeRows
				.filter(({ source }) => source === PLATFORM)
				.reduce((total, row) => total + Number(row.count), 0),
			fraudulentLines: fraudRows.reduce(
				(total, row) => total + Number(row.count),
				0
			),
			reconciledWindows: attestationRows.reduce(
				(total, row) => total + Number(row.count),
				0
			),
		},
		recentFraudulentLines: fraudRows
			.filter(({ recent }) => recent)
			.reduce((total, row) => total + Number(row.count), 0),
		recentPlatformSuccesses: sumOf(
			recentOutcomes.filter(({ source }) => source === PLATFORM),
			'placements',
			SUCCESS
		),
	};
}

function outcomeMass(rows: readonly OutcomeRow[]): MachineOutcomeMass {
	const platformSuccesses = sumOf(
		rows.filter(({ source }) => source === PLATFORM),
		'mass',
		SUCCESS
	);
	const reportedSuccesses = sumOf(
		rows.filter(({ source }) => source === MACHINE),
		'mass',
		SUCCESS
	);
	return {
		successful:
			platformSuccesses +
			reportedSuccesses * MACHINE_TRUST_POLICY.machineReportedSuccessWeight,
		machineFailures: sumOf(rows, 'mass', FAILURE),
		unattributedFailures: sumOf(rows, 'mass', UNATTRIBUTED),
	};
}

function attestationMass(
	rows: readonly AttestationRow[]
): MachineAttestationMass {
	return rows.reduce<MachineAttestationMass>(
		(total, row) => ({
			windowMass: total.windowMass + Number(row.mass ?? 0),
			intendedMicroUsd: total.intendedMicroUsd + Number(row.intended ?? 0),
			unattestedMicroUsd:
				total.unattestedMicroUsd + Number(row.unattested ?? 0),
		}),
		{ windowMass: 0, intendedMicroUsd: 0, unattestedMicroUsd: 0 }
	);
}

function sumOf(
	rows: readonly OutcomeRow[],
	column: 'mass' | 'count' | 'placements',
	kind: string
): number {
	return rows
		.filter((row) => row.kind === kind)
		.reduce((total, row) => total + Number(row[column] ?? 0), 0);
}

export async function peerFailureRate(
	manager: EntityManager,
	machineId: string
): Promise<number | null> {
	const [row] = await manager.execute<
		{ failures: number | null; samples: number | null }[]
	>(
		`SELECT SUM("failureMass") AS failures, SUM("successMass" + "failureMass") AS samples
		FROM machine_assessment WHERE "machineId" <> ? AND "policyVersion" = ?`,
		[machineId, MACHINE_TRUST_POLICY.version]
	);
	const samples = Number(row?.samples ?? 0);
	return samples > 0 ? Number(row?.failures ?? 0) / samples : null;
}
