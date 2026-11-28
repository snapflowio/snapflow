/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_MINUTE,
	SECONDS_PER_DAY,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { SettlementAlertKind } from './settlement-alert.constants';

export const SANCTIONS_LIST_SYNC = {
	JOB: 'sync-sanctions-list',
	LOCK_KEY: 'sync-sanctions-list',
	LOCK_SECONDS: 10 * SECONDS_PER_MINUTE,
	INTERVAL_SECONDS: SECONDS_PER_DAY,
	STALE_SECONDS: 2 * SECONDS_PER_DAY,
	DOWNLOAD_TIMEOUT_MILLISECONDS: 5 * MILLISECONDS_PER_MINUTE,
	MINIMUM_RECORD_COUNT: 1_000,
	MAXIMUM_ADDRESS_DROP_FRACTION: 0.5,
} as const;

export const SANCTIONS_LIST_DOWNLOAD = {
	PROTOCOL: 'https:',
	MAXIMUM_REDIRECTS: 5,
	LOCATION_HEADER: 'location',
	REDIRECT_STATUSES: new Set([301, 302, 303, 307, 308]) as ReadonlySet<number>,
} as const;

export const SANCTIONS_LIST_SYNC_ID = 1;

export const SANCTIONS_ALERT_DELIVERY = {
	WALLETS_PER_ALERT: 5,
} as const;

export const SanctionsPendingAlertKind = {
	MATCH: SettlementAlertKind.SANCTIONS_MATCH,
	DELISTED: SettlementAlertKind.SANCTIONS_DELISTED,
} as const;

export type SanctionsPendingAlertKind =
	(typeof SanctionsPendingAlertKind)[keyof typeof SanctionsPendingAlertKind];

export const SDN_XML_ELEMENT = {
	PUBLISH_INFORMATION: 'publshInformation',
	PUBLISH_DATE: 'Publish_Date',
	RECORD_COUNT: 'Record_Count',
	ENTRY: 'sdnEntry',
	UID: 'uid',
	FIRST_NAME: 'firstName',
	LAST_NAME: 'lastName',
	ID_LIST: 'idList',
	ID: 'id',
	ID_TYPE: 'idType',
	ID_NUMBER: 'idNumber',
} as const;

export const SDN_DIGITAL_CURRENCY_ID_TYPE_PREFIX =
	'Digital Currency Address - ';

export const SDN_PUBLISH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export const SDN_UID_PATTERN = /^[1-9]\d{0,8}$/;

export const SDN_NAME_SEPARATOR = ' ';

export const SANCTIONED_CURRENCY_SEPARATOR = ', ';
