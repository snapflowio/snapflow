/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SECONDS_PER_DAY,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const IspComplaintProtocol = {
	TCP: 'tcp',
	UDP: 'udp',
	ICMP: 'icmp',
} as const;
export type IspComplaintProtocol =
	(typeof IspComplaintProtocol)[keyof typeof IspComplaintProtocol];

export const IspComplaintOutcome = {
	NOT_SNAPFLOW: 'not_snapflow',
	ATTRIBUTED: 'attributed',
	MANUAL_REVIEW: 'manual_review',
	RECORDS_INCOMPLETE: 'records_incomplete',
} as const;
export type IspComplaintOutcome =
	(typeof IspComplaintOutcome)[keyof typeof IspComplaintOutcome];

export const ConnectionWorkloadKind = {
	SANDBOX: 'sandbox',
	BUILDER: 'builder',
} as const;
export type ConnectionWorkloadKind =
	(typeof ConnectionWorkloadKind)[keyof typeof ConnectionWorkloadKind];

export const ISP_COMPLAINT_MATCHING = {
	clockSkewSeconds: 5 * SECONDS_PER_MINUTE,
	maximumWindowSeconds: 7 * SECONDS_PER_DAY,
} as const;

export const CONNECTION_RECORDS = {
	retentionSeconds: 90 * SECONDS_PER_DAY,
	bucketSeconds: 60 * SECONDS_PER_MINUTE,
	maximumPerReport: 20_000,
	cleanupBatchSize: 10_000,
	maximumWindowSeconds: SECONDS_PER_DAY,
	maximumClockSkewSeconds: SECONDS_PER_MINUTE,
	releaseGraceSeconds: 10 * SECONDS_PER_MINUTE,
} as const;

export const CONNECTION_REPORT_ROUTE = {
	controller: 'machines/reports/v1',
	path: 'connections',
	requestBodyLimit: '8mb',
} as const;

export const ISP_COMPLAINT_LIST_LIMIT = 50;

export const ISP_STATEMENT_FILE = {
	contentType: 'application/pdf',
	namePrefix: 'snapflow-isp-statement-',
} as const;

export const MACHINE_ADDRESS_HISTORY = {
	refreshAfterSeconds: SECONDS_PER_MINUTE,
	maximumGapSeconds: 5 * SECONDS_PER_MINUTE,
} as const;
