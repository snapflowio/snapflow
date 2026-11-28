/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Address } from 'viem';
import type { SanctionedAddress } from '../../entities/sanctioned-address.entity';
import type { SdnAddress } from '../../types/sanctions.types';

export interface SanctionedAddressDiff {
	readonly added: readonly SdnAddress[];
	readonly changed: readonly (readonly [SanctionedAddress, SdnAddress])[];
	readonly removed: readonly SanctionedAddress[];
}

function differs(stored: SanctionedAddress, listed: SdnAddress): boolean {
	return (
		stored.sdnEntryUid !== listed.sdnEntryUid ||
		stored.entityName !== listed.entityName ||
		stored.currency !== listed.currency
	);
}

export function diffSanctionedAddresses(
	stored: readonly SanctionedAddress[],
	listed: readonly SdnAddress[]
): SanctionedAddressDiff {
	const storedByAddress = new Map<Address, SanctionedAddress>(
		stored.map((entry) => [entry.address, entry])
	);
	const listedAddresses = new Set(listed.map(({ address }) => address));
	const changed: [SanctionedAddress, SdnAddress][] = [];
	const added: SdnAddress[] = [];
	for (const entry of listed) {
		const known = storedByAddress.get(entry.address);
		if (!known) added.push(entry);
		else if (differs(known, entry)) changed.push([known, entry]);
	}
	return {
		added,
		changed,
		removed: stored.filter(({ address }) => !listedAddresses.has(address)),
	};
}
