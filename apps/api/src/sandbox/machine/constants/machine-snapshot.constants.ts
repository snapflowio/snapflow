/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';

export const OCI_DIGEST_PREFIX = 'sha256:';

export const MACHINE_SNAPSHOT_INVENTORY_LIMITS = {
	maximumSnapshotsPerReport: 192,
	maximumDocumentLength: 96 * 1024,
	maximumErrorReasonLength: 2_048,
} as const;

export const MACHINE_SNAPSHOT_TARGETS = {
	propagationFactor: 1 / 3,
	scaleDownExcessFactor: 1.15,
	scaleDownProtectionMilliseconds: 60 * MILLISECONDS_PER_MINUTE,
	scaleDownBatchSize: 200,
	assignmentBatchSize: 100,
	retentionBatchSize: 500,
} as const;
