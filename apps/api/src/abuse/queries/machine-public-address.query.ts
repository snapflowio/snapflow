/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MACHINE_ADDRESS_HISTORY } from '../constants/isp-complaint.constants';

const RECORD_ADDRESS_SQL = `
	WITH latest AS (
		SELECT id, address, "lastSeenAt" >= now() - make_interval(secs => ?) AS continuous
		FROM machine_public_address
		WHERE "machineId" = ?
		ORDER BY "lastSeenAt" DESC
		LIMIT 1
	), extended AS (
		UPDATE machine_public_address SET "lastSeenAt" = now()
		FROM latest
		WHERE machine_public_address.id = latest.id
		  AND latest.address = ?
		  AND latest.continuous
		  AND machine_public_address."lastSeenAt" < now() - make_interval(secs => ?)
		RETURNING machine_public_address.id
	)
	INSERT INTO machine_public_address ("machineId", address, "firstSeenAt", "lastSeenAt")
	SELECT ?, ?, now(), now()
	WHERE NOT EXISTS (SELECT 1 FROM latest WHERE latest.address = ? AND latest.continuous)`;

const ADDRESS_COVERED_SQL = `
	SELECT EXISTS (
		SELECT 1 FROM machine_public_address
		WHERE "machineId" = ? AND address = ?
		  AND "firstSeenAt" <= ?
		  AND "lastSeenAt" >= ?
	) AS covered`;

export async function recordMachinePublicAddress(
	manager: EntityManager,
	machineId: string,
	address: string
): Promise<void> {
	await manager.execute(RECORD_ADDRESS_SQL, [
		MACHINE_ADDRESS_HISTORY.maximumGapSeconds,
		machineId,
		address,
		MACHINE_ADDRESS_HISTORY.refreshAfterSeconds,
		machineId,
		address,
		address,
	]);
}

export async function machineAddressCovered(
	manager: EntityManager,
	machineId: string,
	address: string,
	window: { from: Date; until: Date }
): Promise<boolean> {
	const [row] = await manager.execute<{ covered: boolean }[]>(
		ADDRESS_COVERED_SQL,
		[machineId, address, window.from, window.until]
	);
	return row?.covered ?? false;
}
