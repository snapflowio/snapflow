/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { VolumeBackupState } from '../../volume/enums/volume-backup-state.enum';
import { VolumeState } from '../../volume/enums/volume-state.enum';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import {
	type ScheduledSandbox,
	type ScheduledVolume,
	selectDueVolumeBackups,
	type VolumeBackupScheduleInput,
} from './volume-backup-schedule.util';

const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const CUTOFF = new Date('2026-11-02T12:00:00.000Z');
const STALE = new Date(CUTOFF.getTime() - MILLISECONDS_PER_MINUTE);
const FRESH = new Date(CUTOFF.getTime() + MILLISECONDS_PER_MINUTE);

function sandbox(
	id: string,
	overrides: Partial<ScheduledSandbox> = {}
): ScheduledSandbox {
	return {
		id,
		organizationId: ORGANIZATION_ID,
		machineId: MACHINE_ID,
		state: SandboxState.STARTED,
		desiredState: SandboxDesiredState.STARTED,
		backupState: BackupState.COMPLETED,
		...overrides,
	};
}

function volume(
	id: string,
	sandboxId: string,
	overrides: Partial<ScheduledVolume> = {}
): ScheduledVolume {
	return {
		id,
		state: VolumeState.READY,
		backupState: VolumeBackupState.COMPLETED,
		lastBackupAt: STALE,
		activeAttachmentId: sandboxId,
		activeMachineId: MACHINE_ID,
		...overrides,
	};
}

function input(
	volumes: ScheduledVolume[],
	sandboxes: ScheduledSandbox[],
	busySandboxIds: string[] = []
): VolumeBackupScheduleInput {
	return {
		volumes,
		sandboxes,
		busySandboxIds: new Set(busySandboxIds),
		readyMachineIds: new Set([MACHINE_ID]),
		cutoff: CUTOFF,
	};
}

describe('selectDueVolumeBackups', () => {
	it('groups the overdue volumes of each running sandbox', () => {
		const due = selectDueVolumeBackups(
			input(
				[
					volume('volume-a', 'sandbox-1'),
					volume('volume-b', 'sandbox-1', { lastBackupAt: null }),
					volume('volume-c', 'sandbox-1', { lastBackupAt: FRESH }),
				],
				[sandbox('sandbox-1')]
			)
		);

		assert.deepEqual(due, [
			{
				sandboxId: 'sandbox-1',
				organizationId: ORGANIZATION_ID,
				machineId: MACHINE_ID,
				volumeIds: ['volume-a', 'volume-b'],
			},
		]);
	});

	it('skips sandboxes that are not running', () => {
		const due = selectDueVolumeBackups(
			input(
				[
					volume('volume-a', 'stopped'),
					volume('volume-b', 'stopping'),
					volume('volume-c', 'other-machine'),
				],
				[
					sandbox('stopped', { state: SandboxState.STOPPED }),
					sandbox('stopping', { desiredState: SandboxDesiredState.STOPPED }),
					sandbox('other-machine', { machineId: 'unready-machine' }),
				]
			)
		);

		assert.deepEqual(due, []);
	});

	it('skips sandboxes and volumes with a backup in flight', () => {
		const due = selectDueVolumeBackups(
			input(
				[
					volume('volume-a', 'busy-job'),
					volume('volume-b', 'busy-snapshot'),
					volume('volume-c', 'idle', {
						backupState: VolumeBackupState.PENDING,
					}),
				],
				[
					sandbox('busy-job'),
					sandbox('busy-snapshot', { backupState: BackupState.IN_PROGRESS }),
					sandbox('idle'),
				],
				['busy-job']
			)
		);

		assert.deepEqual(due, []);
	});
});
