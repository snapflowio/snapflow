/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createPublicKey, verify } from 'node:crypto';
import type { BillingAuditFailure } from '../../constants/billing-audit.constants';
import { BillingEvidenceAuditError } from '../../exceptions/billing-evidence-audit.exception';

export function assertEvidence(
	condition: boolean,
	failure: BillingAuditFailure,
	detail: string
): asserts condition {
	if (!condition) throw new BillingEvidenceAuditError(failure, detail);
}

export function signatureVerifies(
	payload: Buffer,
	publicKeyPem: string,
	signatureBase64Url: string
): boolean {
	try {
		return verify(
			null,
			payload,
			createPublicKey(publicKeyPem),
			Buffer.from(signatureBase64Url, 'base64url')
		);
	} catch {
		return false;
	}
}
