/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isDeepStrictEqual } from 'node:util';
import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	HttpStatus,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
} from '../../audit/constants/audit-principal.constants';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { AuditService } from '../../audit/services/audit.service';
import { errorMessage } from '../../common/utils/error/error.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import {
	SETTINGS_CACHE_MAX_AGE_MILLISECONDS,
	SETTINGS_DEFAULTS,
	SETTINGS_FIRST_RUN_ACTOR_ID,
	SETTINGS_ID,
	SETTINGS_PROBLEM_CODE,
	SETTINGS_RESOURCE_VERSION_INITIAL,
	SETTINGS_WAKE,
	SettingsEvents,
} from '../constants/settings.constants';
import { Settings } from '../entities/settings.entity';
import { SettingsChangedEvent } from '../events/settings-changed.event';
import {
	type SettingsChanges,
	type SettingsSnapshot,
	toSettingsSnapshot,
} from '../types/settings.types';
import { parseIpNetwork } from '../utils/ip-network.util';
import { settingsInconsistency } from '../utils/settings-consistency.util';

const SECURE_PROTOCOL = 'https:';

interface CachedSettings {
	readonly settings: SettingsSnapshot;
	readonly loadedAt: number;
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter((entry) => entry[1] !== undefined)
	) as Partial<T>;
}

@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SettingsService.name);
	#cached: CachedSettings | null = null;
	#observed: SettingsSnapshot | null = null;
	#loading: Promise<SettingsSnapshot> | null = null;
	#generation = 0;
	#unsubscribe: (() => void) | null = null;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly wake: ControlWakeService,
		private readonly events: EventEmitter2,
		private readonly config: TypedConfigService,
		private readonly audit: AuditService
	) {}

	async onModuleInit(): Promise<void> {
		this.#unsubscribe = this.wake.subscribe(
			SETTINGS_WAKE.topic,
			SETTINGS_WAKE.id,
			() => this.refresh()
		);
		await this.ensureInitialized();
	}

	onModuleDestroy(): void {
		this.#unsubscribe?.();
	}

	async get(): Promise<SettingsSnapshot> {
		const cached = this.#cached;
		if (
			cached &&
			Date.now() - cached.loadedAt < SETTINGS_CACHE_MAX_AGE_MILLISECONDS
		) {
			return cached.settings;
		}
		return this.#loading ?? this.startLoad();
	}

	update(
		expectedVersion: number,
		changes: SettingsChanges,
		actorUserId: string | null
	): Promise<SettingsSnapshot> {
		return this.change(actorUserId, (manager, settings) => {
			if (settings.resourceVersion !== expectedVersion) {
				throw new ConflictException({
					code: SETTINGS_PROBLEM_CODE.VERSION_CONFLICT,
					message: 'The settings changed before this request',
				});
			}
			this.apply(manager, settings, changes);
		});
	}

	set(
		changes: SettingsChanges,
		actorUserId: string
	): Promise<SettingsSnapshot> {
		return this.change(actorUserId, (manager, settings) =>
			this.apply(manager, settings, changes)
		);
	}

	async applyFirstRun(changes: SettingsChanges): Promise<boolean> {
		let applied = false;
		const settings = await this.change(null, (manager, current) => {
			if (current.resourceVersion !== SETTINGS_RESOURCE_VERSION_INITIAL) {
				return;
			}
			this.apply(manager, current, changes);
			applied = true;
		});
		if (applied) {
			await this.audit.createCompletedLog({
				actorType: AUDIT_ACTOR_TYPE.SYSTEM,
				actorId: SETTINGS_FIRST_RUN_ACTOR_ID,
				credentialType: AUDIT_CREDENTIAL_TYPE.SYSTEM,
				action: AuditAction.UPDATE,
				targetType: AuditTarget.SETTINGS,
				targetId: String(SETTINGS_ID),
				statusCode: HttpStatus.OK,
				metadata: {
					changes,
					resourceVersion: settings.resourceVersion,
				},
			});
		}
		return applied;
	}

	private async change(
		actorUserId: string | null,
		mutate: (manager: EntityManager, settings: Settings) => void
	): Promise<SettingsSnapshot> {
		const settings = await this.entityManager.transactional(async (manager) => {
			const current = await manager.findOneOrFail(
				Settings,
				{ id: SETTINGS_ID },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const before = toSettingsSnapshot(current);
			mutate(manager, current);
			if (!isDeepStrictEqual(before, toSettingsSnapshot(current))) {
				current.updatedBy = actorUserId;
				this.wake.notifyAfterCommit(manager, SETTINGS_WAKE.topic, [
					SETTINGS_WAKE.id,
				]);
			}
			return current;
		});
		return toSettingsSnapshot(settings);
	}

	private apply(
		manager: EntityManager,
		settings: Settings,
		changes: SettingsChanges
	): void {
		manager.assign(settings, withoutUndefined(changes));
		this.assertConsistent(settings);
	}

	private assertConsistent(settings: Settings): void {
		this.assertDistinctNetworks(settings.edgeTrustedHttpProxyCidrs);
		const inconsistency = settingsInconsistency(settings);
		if (inconsistency) {
			throw new BadRequestException(inconsistency);
		}
		const registryUrl = settings.machineGuestRegistryUrl;
		if (
			registryUrl &&
			this.config.get('deployment').hosted &&
			new URL(registryUrl).protocol !== SECURE_PROTOCOL
		) {
			throw new BadRequestException(
				'The machine guest registry must use HTTPS in hosted deployments'
			);
		}
	}

	private assertDistinctNetworks(values: readonly string[]): void {
		const networks = new Set<string>();
		for (const value of values) {
			let network: string;
			try {
				network = parseIpNetwork(value);
			} catch (error) {
				throw new BadRequestException(
					`Trusted HTTP proxy network ${errorMessage(error)}`
				);
			}
			if (networks.has(network)) {
				throw new BadRequestException(
					`Trusted HTTP proxy network ${value} is listed twice`
				);
			}
			networks.add(network);
		}
	}

	private async ensureInitialized(): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			if ((await manager.count(Settings, SETTINGS_ID)) > 0) {
				return;
			}
			await manager.upsert(
				Settings,
				{ ...SETTINGS_DEFAULTS, id: SETTINGS_ID },
				{ onConflictFields: ['id'], onConflictAction: 'ignore' }
			);
		});
	}

	private startLoad(): Promise<SettingsSnapshot> {
		const loading = this.load().finally(() => {
			if (this.#loading === loading) this.#loading = null;
		});
		this.#loading = loading;
		return loading;
	}

	private async load(): Promise<SettingsSnapshot> {
		const generation = this.#generation;
		const settings = toSettingsSnapshot(
			await this.entityManager
				.fork()
				.findOneOrFail(Settings, { id: SETTINGS_ID })
		);
		if (generation === this.#generation) {
			this.#cached = { settings, loadedAt: Date.now() };
		}
		this.observe(settings);
		return settings;
	}

	private observe(current: SettingsSnapshot): void {
		const previous = this.#observed;
		if (previous && current.resourceVersion <= previous.resourceVersion) {
			return;
		}
		this.#observed = current;
		if (previous) {
			this.events.emit(
				SettingsEvents.CHANGED,
				new SettingsChangedEvent(previous, current)
			);
		}
	}

	private refresh(): void {
		this.#generation += 1;
		this.#cached = null;
		this.startLoad().catch((error: unknown) => {
			this.logger.warn(`Could not reload the settings: ${errorMessage(error)}`);
		});
	}
}
