/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapshotRetention } from '@snapflow/machine-proto';
import type { SnapshotTemplatePreparation } from '../proto/snapshot-template.util';

export type DesiredSnapshotSource =
	| { kind: 'registry'; registryId?: string }
	| { kind: 'local' };

export interface SnapshotDemand {
	ref: string;
	source: DesiredSnapshotSource;
	template: SnapshotTemplatePreparation | null;
	retention: SnapshotRetention;
}

function authenticated(source: DesiredSnapshotSource): boolean {
	return source.kind === 'registry' && source.registryId !== undefined;
}

export function mergeDesiredSnapshots(
	demands: readonly SnapshotDemand[]
): Map<string, SnapshotDemand> {
	const merged = new Map<string, SnapshotDemand>();
	for (const demand of demands) {
		const current = merged.get(demand.ref);
		if (!current) {
			merged.set(demand.ref, { ...demand });
			continue;
		}
		if (
			current.source.kind === 'registry' &&
			!authenticated(current.source) &&
			authenticated(demand.source)
		) {
			current.source = demand.source;
		}
		current.template ??= demand.template;
		if (demand.retention === SnapshotRetention.REQUIRED) {
			current.retention = SnapshotRetention.REQUIRED;
		}
	}
	return new Map(
		[...merged.entries()].sort(([left], [right]) => (left < right ? -1 : 1))
	);
}
