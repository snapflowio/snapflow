/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxLifecycle } from '@snapflow/machine-proto';
import type { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import type { SandboxState } from '../enums/sandbox-state.enum';
import type { BackupState } from '../volume/enums/backup-state.enum';

export interface SandboxStateFields {
	id: string;
	state: SandboxState;
	desiredState: SandboxDesiredState;
	pending: boolean | undefined;
	machineId: string | null;
	runtimeLifecycle: SandboxLifecycle | null;
	backupState: BackupState;
	backupSnapshot: string | null;
	backupRegistryId: string | null;
	errorReason: string | null;
}

export interface SandboxInvariantChanges {
	pending?: boolean;
	machineId?: null;
	backupState?: BackupState;
	recoverable?: boolean;
	runtimeLifecycle?: null;
	runtimeSpec?: null;
	runtimeSpecDigest?: null;
	runtimeDirectives?: null;
	runtimeRegistryId?: null;
}
