/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BackupState, type Sandbox } from '@snapflow/api-client';
import * as z from 'zod';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';
import { backupStateLabel } from './sandbox-state.ts';

export type NamedRecoveryAction = 'fork' | 'snapshot';

export const DEFAULT_RECOVERY_ACTION: NamedRecoveryAction = 'fork';

export const NAMED_ACTION_COPY = {
	fork: { title: 'Fork sandbox', label: 'Fork' },
	snapshot: {
		title: 'Create snapshot',
		label: 'Create',
	},
} as const satisfies Record<
	NamedRecoveryAction,
	{ title: string; label: string }
>;

export const namedRecoverySchema = z
	.object({
		action: z.enum(['fork', 'snapshot']),
		name: z.string(),
	})
	.superRefine((value, context) => {
		if (value.action === 'snapshot' && !value.name.trim()) {
			context.addIssue({
				code: 'custom',
				message: 'Snapshot name is required',
				path: ['name'],
			});
		}
	});

export type RecoveryRowKind = 'Parent' | 'Fork';

export interface RecoveryRow {
	sandbox: Sandbox;
	kind: RecoveryRowKind;
}

interface SandboxLineage {
	ancestors: readonly Sandbox[];
	forks: readonly Sandbox[];
}

function createdTime(sandbox: Sandbox): number {
	return sandbox.createdAt ? new Date(sandbox.createdAt).getTime() : 0;
}

export function recoveryRows({
	ancestors,
	forks,
}: SandboxLineage): RecoveryRow[] {
	return [
		...ancestors.map((sandbox) => ({ sandbox, kind: 'Parent' as const })),
		...forks.map((sandbox) => ({ sandbox, kind: 'Fork' as const })),
	].sort(
		(left, right) => createdTime(right.sandbox) - createdTime(left.sandbox)
	);
}

interface BackupStatus {
	label: string;
	shape: StatusRingShape;
	tone: StatusRingTone;
}

const BACKUP_STATUS: Record<BackupState, Omit<BackupStatus, 'label'>> = {
	[BackupState.None]: { shape: 'empty', tone: 'neutral' },
	[BackupState.Pending]: { shape: 'dashed', tone: 'neutral' },
	[BackupState.InProgress]: { shape: 'half', tone: 'neutral' },
	[BackupState.Completed]: { shape: 'check', tone: 'success' },
	[BackupState.Error]: { shape: 'cross', tone: 'error' },
};

export function backupStatus(
	sandbox: Pick<Sandbox, 'backupState'>
): BackupStatus {
	const state = sandbox.backupState ?? BackupState.None;
	return { ...BACKUP_STATUS[state], label: backupStateLabel(state) };
}
