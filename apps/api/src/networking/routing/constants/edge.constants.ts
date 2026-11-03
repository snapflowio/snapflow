/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM } from '../../../settings/platform/constants/settings.constants';

export const EDGE_STATUS = {
	ENROLLING: 'enrolling',
	ACTIVE: 'active',
	DRAINING: 'draining',
	DISABLED: 'disabled',
} as const;
export type EdgeStatus = (typeof EDGE_STATUS)[keyof typeof EDGE_STATUS];

export const EDGE_IDENTITY = {
	keyIdPrefix: 'ed25519:',
	enrollmentProofDomain: 'snapflow.edge-enrollment.v1',
	sessionProofDomain: 'snapflow.edge-session.v1',
	enrollmentSecretBytes: 32,
	enrollmentDurationMilliseconds: 24 * 60 * 60 * 1_000,
	sessionDurationMilliseconds: 5 * 60 * 1_000,
	sessionReplacementGraceMilliseconds: 30 * 1_000,
	proofClockSkewMilliseconds: 5 * 60 * 1_000,
	minimumProofNonceBytes: 16,
	signatureBytes: 64,
	sessionTokenBytes: 32,
	base64UrlEd25519SignatureLength: 86,
	hashAlgorithm: 'sha256',
	usageProofDomain: 'snapflow.edge-usage.v2',
} as const;

export const EDGE_SESSION_HEADER = {
	id: 'x-snapflow-edge-session-id',
	token: 'x-snapflow-edge-session-token',
} as const;

export const EDGE_USAGE_CHAIN_POSITION = {
	NEXT: 'next',
	EPOCH_CLOSED: 'epoch_closed',
	CONFLICT: 'conflict',
} as const;
export type EdgeUsageChainPosition =
	(typeof EDGE_USAGE_CHAIN_POSITION)[keyof typeof EDGE_USAGE_CHAIN_POSITION];

export const EDGE_CONTROL_LIMITS = {
	routeSnapshotLifetimeMilliseconds: 60 * 1_000,
	routeSnapshotRefreshIntervalMilliseconds: 30 * 1_000,
	controlSnapshotRefreshBatchSize: 100,
	routeSnapshotPublicationAttempts: 4,
	maximumRoutesPerSnapshot: 10_000,
	maximumBindingsPerSnapshot: 20_000,
	maximumHostnamesPerHttpRoute: 24,
	maximumTrustedProxyCidrs: EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
	defaultHttpTrafficWeight: 100,
	maximumListenerStatusesPerHeartbeat: 10_000,
	maximumBindingAcknowledgementsPerHeartbeat: 20_000,
	maximumAccessSessionsPerHeartbeat: 10_000,
	activityUpdateConcurrency: 32,
	maximumUsageSamplesPerCheckpoint: 10_000,
	maximumUsageIntervalMilliseconds: 10 * 60 * 1_000,
	maximumUsageLatenessMilliseconds: 24 * 60 * 60 * 1_000,
	maximumUsageClockSkewMilliseconds: 5 * 60 * 1_000,
} as const;
