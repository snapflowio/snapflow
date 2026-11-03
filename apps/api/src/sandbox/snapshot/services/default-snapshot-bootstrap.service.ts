/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import {
	type BeforeApplicationShutdown,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { PersonalOrganizationService } from '../../../organization/tenant/services/personal-organization.service';
import { SettingsEvents } from '../../../settings/platform/constants/settings.constants';
import { SettingsChangedEvent } from '../../../settings/platform/events/settings-changed.event';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import { UserService } from '../../../user/services/user.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { platformWorkloadPlacement } from '../../placement/utils/sandbox-placement.util';
import type { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotLifecycleManager } from '../managers/snapshot-lifecycle.manager';
import { SnapshotService } from './snapshot.service';
import { SnapshotCreationService } from './snapshot-creation.service';
import { SnapshotStateService } from './snapshot-state.service';

const CAPACITY_POLL_INTERVAL_MILLISECONDS = 1_000;
const CAPACITY_LOG_INTERVAL_ATTEMPTS = 30;
const RECHECK_MAXIMUM_DELAY_MINUTES = 30;
const RECHECK_INITIAL_DELAY_MILLISECONDS = MILLISECONDS_PER_MINUTE;
const RECHECK_MAXIMUM_DELAY_MILLISECONDS =
	RECHECK_MAXIMUM_DELAY_MINUTES * MILLISECONDS_PER_MINUTE;
const RETRY_BACKOFF_FACTOR = 2;
const IMPORTING_STATES: ReadonlySet<SnapshotState> = new Set([
	SnapshotState.PENDING,
	SnapshotState.PULLING,
]);

// Keeps the platform default snapshot importable: creates it when missing, keeps
// checking while it imports, and re-queues a failed import with capped backoff.
@Injectable()
export class DefaultSnapshotBootstrapService
	implements BeforeApplicationShutdown
{
	private readonly logger = new Logger(DefaultSnapshotBootstrapService.name);
	private readonly abort = new AbortController();
	#started = false;
	#running: Promise<void> | null = null;
	#recheck: NodeJS.Timeout | null = null;
	#retryDelayMilliseconds = RECHECK_INITIAL_DELAY_MILLISECONDS;

	constructor(
		private readonly orm: MikroORM,
		private readonly settings: SettingsService,
		private readonly users: UserService,
		private readonly personalOrganizations: PersonalOrganizationService,
		private readonly snapshots: SnapshotService,
		private readonly snapshotCreation: SnapshotCreationService,
		private readonly snapshotStates: SnapshotStateService,
		private readonly lifecycle: SnapshotLifecycleManager,
		private readonly machineScheduling: MachineSchedulingService
	) {}

	beforeApplicationShutdown(): void {
		this.abort.abort();
		if (this.#recheck) clearTimeout(this.#recheck);
	}

	start(): void {
		this.#started = true;
		this.trigger();
	}

	@OnEvent(SettingsEvents.CHANGED)
	onSettingsChanged(event: SettingsChangedEvent): void {
		if (
			this.#started &&
			event.changed('defaultSnapshot', 'defaultSandboxClass')
		) {
			this.#retryDelayMilliseconds = RECHECK_INITIAL_DELAY_MILLISECONDS;
			this.trigger();
		}
	}

	private trigger(): void {
		this.#running ??= RequestContext.create(this.orm.em, () => this.ensure())
			.catch((error: unknown) => {
				if (!this.abort.signal.aborted) {
					this.logger.error('Could not import the default snapshot', error);
					this.scheduleRecheck(true);
				}
			})
			.finally(() => {
				this.#running = null;
			});
	}

	private async ensure(): Promise<void> {
		const { defaultSnapshot } = await this.settings.get();
		if (!defaultSnapshot) return;
		const administrator = await this.users.findOldestAdministrator();
		if (!administrator) {
			this.logger.warn(
				'No administrator exists yet; run create-admin to import the default snapshot'
			);
			return;
		}
		const owner = await this.personalOrganizations.ensure(administrator.id);
		const existing = await this.find(defaultSnapshot, owner.id);
		if (existing?.state === SnapshotState.ACTIVE) {
			this.#retryDelayMilliseconds = RECHECK_INITIAL_DELAY_MILLISECONDS;
			return;
		}
		if (existing?.state === SnapshotState.ERROR) {
			await this.retry(existing);
			return;
		}
		if (existing) {
			if (IMPORTING_STATES.has(existing.state)) this.scheduleRecheck(false);
			return;
		}

		await this.waitForCapacity();
		this.logger.log(`Importing the default snapshot ${defaultSnapshot}`);
		await this.snapshotCreation.createFromPull(
			owner.id,
			{ name: defaultSnapshot, imageName: defaultSnapshot },
			true
		);
		this.scheduleRecheck(false);
	}

	private async retry(snapshot: Snapshot): Promise<void> {
		this.logger.warn(
			`The default snapshot ${snapshot.name} failed to import (${snapshot.errorReason ?? 'no reason recorded'}); retrying`
		);
		await this.snapshotStates.retryFailedSnapshot(snapshot);
		await this.lifecycle.syncSnapshotState(snapshot.id);
		this.scheduleRecheck(true);
	}

	private scheduleRecheck(afterFailure: boolean): void {
		if (this.abort.signal.aborted) return;
		if (this.#recheck) clearTimeout(this.#recheck);
		const delay = this.#retryDelayMilliseconds;
		if (afterFailure) {
			this.#retryDelayMilliseconds = Math.min(
				delay * RETRY_BACKOFF_FACTOR,
				RECHECK_MAXIMUM_DELAY_MILLISECONDS
			);
		}
		this.#recheck = setTimeout(() => this.trigger(), delay);
		this.#recheck.unref();
	}

	private async find(
		name: string,
		organizationId: string
	): Promise<Snapshot | null> {
		try {
			return await this.snapshots.getSnapshotByName(name, organizationId);
		} catch (error) {
			if (error instanceof NotFoundException) return null;
			throw error;
		}
	}

	private async waitForCapacity(): Promise<void> {
		let attempt = 0;
		while (!this.abort.signal.aborted) {
			const settings = await this.settings.get();
			const machine = await this.machineScheduling.findBestMachine({
				customerOrganizationId: null,
				placement: platformWorkloadPlacement(),
				sandboxClass: settings.defaultSandboxClass,
				gpu: 0,
				gpuType: null,
			});
			if (machine) return;
			attempt += 1;
			if (attempt % CAPACITY_LOG_INTERVAL_ATTEMPTS === 0) {
				this.logger.warn(
					'No enrolled machine capacity is ready; the default snapshot is waiting'
				);
			}
			await sleep(CAPACITY_POLL_INTERVAL_MILLISECONDS, undefined, {
				signal: this.abort.signal,
			});
		}
	}
}
