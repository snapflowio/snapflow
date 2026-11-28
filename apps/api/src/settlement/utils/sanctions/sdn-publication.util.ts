/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SANCTIONS_LIST_SYNC,
	SDN_PUBLISH_DATE_PATTERN,
} from '../../constants/sanctions.constants';
import type { SanctionsListSync } from '../../entities/sanctions-list-sync.entity';
import type { SdnPublication } from '../../types/sanctions.types';
import type { SdnListContents } from './sdn-list-collector.util';

function publishedAt(publishDate: string): Date {
	const match = SDN_PUBLISH_DATE_PATTERN.exec(publishDate);
	if (!match) {
		throw new Error(`The SDN list has no valid publish date: "${publishDate}"`);
	}
	const [, month, day, year] = match.map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		throw new Error(`The SDN list has no valid publish date: "${publishDate}"`);
	}
	return date;
}

function recordCount({ recordCount, entryCount }: SdnListContents): number {
	const count = Number(recordCount);
	if (
		!Number.isSafeInteger(count) ||
		count < SANCTIONS_LIST_SYNC.MINIMUM_RECORD_COUNT
	) {
		throw new Error(
			`The SDN list reports an implausible record count: "${recordCount}"`
		);
	}
	if (count !== entryCount) {
		throw new Error(
			`The SDN list reports ${count} records but contains ${entryCount}`
		);
	}
	return count;
}

export function sdnPublication(contents: SdnListContents): SdnPublication {
	const publication = {
		publishedAt: publishedAt(contents.publishDate),
		recordCount: recordCount(contents),
		addresses: contents.addresses,
	};
	if (publication.addresses.length === 0) {
		throw new Error('The SDN list names no EVM addresses');
	}
	return publication;
}

export function assertPublicationSupersedes(
	publication: SdnPublication,
	stored: Pick<SanctionsListSync, 'publishedAt' | 'addressCount'> | null
): void {
	if (!stored) return;
	if (publication.publishedAt < stored.publishedAt) {
		throw new Error(
			`The SDN list was published ${publication.publishedAt.toISOString()}, before the stored ${stored.publishedAt.toISOString()} one; keeping the stored list`
		);
	}
	const minimum = Math.ceil(
		stored.addressCount *
			(1 - SANCTIONS_LIST_SYNC.MAXIMUM_ADDRESS_DROP_FRACTION)
	);
	if (publication.addresses.length < minimum) {
		throw new Error(
			`The SDN list names ${publication.addresses.length} EVM addresses, down from ${stored.addressCount}; refusing a drop that large`
		);
	}
}
