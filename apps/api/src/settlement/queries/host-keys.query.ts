/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address } from 'viem';
import { MachineHostKey } from '../../machine/entities/machine-host-key.entity';

interface OwnedHostKey {
	address: Address;
	machineId: string;
	machineName: string;
	organizationId: string;
	retiredAt: Date | null;
}

const OWNED_HOST_KEY_COLUMNS = `k.address, k."machineId", m.name AS "machineName",
	m."organizationId", k."retiredAt"`;

export async function hostKeyOwners(
	manager: EntityManager,
	addresses: readonly Address[]
): Promise<Map<Address, string>> {
	if (addresses.length === 0) return new Map();
	const rows = await manager.execute<OwnedHostKey[]>(
		`SELECT ${OWNED_HOST_KEY_COLUMNS}
		 FROM machine_host_key k JOIN machine m ON m.id = k."machineId"
		 WHERE k.address IN (?)`,
		[[...new Set(addresses)]]
	);
	return new Map(rows.map((row) => [row.address, row.organizationId]));
}

export function organizationHostKeys(
	manager: EntityManager,
	organizationId: string
): Promise<OwnedHostKey[]> {
	return manager.execute<OwnedHostKey[]>(
		`SELECT ${OWNED_HOST_KEY_COLUMNS}
		 FROM machine_host_key k JOIN machine m ON m.id = k."machineId"
		 WHERE m."organizationId" = ?
		 ORDER BY k."retiredAt" DESC NULLS FIRST, m.name, k."registeredAt"`,
		[organizationId]
	);
}

export async function currentHostKey(
	manager: EntityManager,
	machineId: string
): Promise<Address | null> {
	const key = await manager.findOne(
		MachineHostKey,
		{ machineId, retiredAt: null },
		{ fields: ['address'] }
	);
	return key?.address ?? null;
}
