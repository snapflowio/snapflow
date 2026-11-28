/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { type Address, getAddress, isAddressEqual } from 'viem';
import { ROLE_GRANTED_EVENT } from '../constants/escrow.constants';
import type { EscrowIdentity } from '../types/escrow.types';

export interface SnapflowOperationalAddresses {
	relayer: Address;
	feeReceiver: Address;
}

export async function snapflowControlledAmong(
	manager: EntityManager,
	escrow: EscrowIdentity,
	operational: SnapflowOperationalAddresses,
	candidates: readonly Address[]
): Promise<Address[]> {
	if (candidates.length === 0) return [];
	const addresses = [
		...new Set(candidates.map((address) => getAddress(address))),
	];
	const rows = await manager.execute<{ address: Address }[]>(
		`SELECT signer."signerAddress" AS address
		 FROM delegated_signer signer
		 WHERE signer."signerAddress" IN (?)
		 UNION
		 SELECT event.args->>'account' AS address
		 FROM escrow_event event
		 WHERE event."chainId" = ? AND event."contractAddress" = ?
		   AND event.kind = ? AND event.args->>'account' IN (?)`,
		[
			addresses,
			escrow.chainId,
			escrow.contractAddress,
			ROLE_GRANTED_EVENT,
			addresses,
		]
	);
	const controlled = [
		operational.relayer,
		operational.feeReceiver,
		...rows.map(({ address }) => address),
	];
	return addresses.filter((address) =>
		controlled.some((known) => isAddressEqual(known, address))
	);
}
