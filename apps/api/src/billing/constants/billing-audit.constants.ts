/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BillingAuditFaultDomain = {
	MACHINE: 'machine',
	PLATFORM: 'platform',
} as const;

export type BillingAuditFaultDomain =
	(typeof BillingAuditFaultDomain)[keyof typeof BillingAuditFaultDomain];

export const BillingAuditFailure = {
	EVIDENCE_MISSING: 'evidence_missing',
	EVIDENCE_SCHEMA_UNSUPPORTED: 'evidence_schema_unsupported',
	EVIDENCE_REFERENCE_MISMATCH: 'evidence_reference_mismatch',
	LINE_CONTENT_MISMATCH: 'line_content_mismatch',
	PRICE_MISMATCH: 'price_mismatch',
	MACHINE_EVIDENCE_INVALID: 'machine_evidence_invalid',
	EDGE_EVIDENCE_INVALID: 'edge_evidence_invalid',
	ATTESTATION_MISMATCH: 'attestation_mismatch',
	CHARGE_EXCEEDS_ATTESTATION: 'charge_exceeds_attestation',
	MACHINE_VERIFICATION_FAILED: 'machine_verification_failed',
	AUDIT_EXCEPTION: 'audit_exception',
} as const;

export type BillingAuditFailure =
	(typeof BillingAuditFailure)[keyof typeof BillingAuditFailure];

export const BILLING_AUDIT_FAULT_DOMAIN: Record<
	BillingAuditFailure,
	BillingAuditFaultDomain
> = {
	[BillingAuditFailure.EVIDENCE_MISSING]: BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.EVIDENCE_SCHEMA_UNSUPPORTED]:
		BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH]:
		BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.LINE_CONTENT_MISMATCH]: BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.PRICE_MISMATCH]: BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.MACHINE_EVIDENCE_INVALID]:
		BillingAuditFaultDomain.MACHINE,
	[BillingAuditFailure.EDGE_EVIDENCE_INVALID]: BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.ATTESTATION_MISMATCH]: BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.CHARGE_EXCEEDS_ATTESTATION]:
		BillingAuditFaultDomain.PLATFORM,
	[BillingAuditFailure.MACHINE_VERIFICATION_FAILED]:
		BillingAuditFaultDomain.MACHINE,
	[BillingAuditFailure.AUDIT_EXCEPTION]: BillingAuditFaultDomain.PLATFORM,
};

export const BILLING_AUDIT_POLICY_VERSION = 1;

export const BILLING_AUDIT_LIMITS = {
	FAILURE_CODE: 64,
	FAULT_DOMAIN: 16,
} as const;
