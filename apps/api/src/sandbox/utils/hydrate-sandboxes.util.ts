/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Sandbox } from '../entities/sandbox.entity';

export async function hydrateSandboxes(
	entityManager: EntityManager,
	rows: readonly { id: string }[]
): Promise<Sandbox[]> {
	if (rows.length === 0) return [];
	const sandboxes = await entityManager.find(Sandbox, {
		id: { $in: rows.map(({ id }) => id) },
	});
	const sandboxById = new Map(
		sandboxes.map((sandbox) => [sandbox.id, sandbox])
	);
	return rows.flatMap(({ id }) => {
		const sandbox = sandboxById.get(id);
		return sandbox ? [sandbox] : [];
	});
}
