/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../../audit/services/audit.service';
import { fakeInstance } from '../../common/testing/instance.fake';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import {
	SETTINGS_CACHE_MAX_AGE_MILLISECONDS,
	SETTINGS_DEFAULTS,
	SETTINGS_RESOURCE_VERSION_INITIAL,
	SETTINGS_WAKE,
	SettingsEvents,
} from '../constants/settings.constants';
import { Settings } from '../entities/settings.entity';
import type { SettingsChangedEvent } from '../events/settings-changed.event';
import { SettingsService } from './settings.service';

const CHANGED_VERSION = SETTINGS_RESOURCE_VERSION_INITIAL + 1;

class StoredSettings {
	resourceVersion = SETTINGS_RESOURCE_VERSION_INITIAL;
	maintenanceMode = false;

	row(): Settings {
		return Object.assign(new Settings(), SETTINGS_DEFAULTS, {
			edgeTrustedHttpProxyCidrs: [],
			maintenanceMode: this.maintenanceMode,
			resourceVersion: this.resourceVersion,
			updatedAt: new Date(0),
		});
	}

	change(): void {
		this.maintenanceMode = !this.maintenanceMode;
		this.resourceVersion += 1;
	}
}

class WakeSwitch {
	key: string | null = null;
	listener: (() => void) | null = null;

	subscribe(topic: string, id: string, listener: () => void): () => void {
		this.key = `${topic}:${id}`;
		this.listener = listener;
		return () => {
			this.listener = null;
		};
	}

	asService(): ControlWakeService {
		return fakeInstance(ControlWakeService, {
			subscribe: this.subscribe.bind(this),
		});
	}
}

function harness() {
	const stored = new StoredSettings();
	const wake = new WakeSwitch();
	const events = new EventEmitter2();
	const changes: SettingsChangedEvent[] = [];
	events.on(SettingsEvents.CHANGED, (event: SettingsChangedEvent) => {
		changes.push(event);
	});
	const manager = fakeInstance(EntityManager, {
		fork: () => ({
			findOneOrFail: async () => stored.row(),
			transactional: async (
				work: (transaction: { count: () => Promise<number> }) => Promise<void>
			) => work({ count: async () => 1 }),
		}),
	});
	const service = new SettingsService(
		manager,
		wake.asService(),
		events,
		fakeInstance(TypedConfigService),
		fakeInstance(AuditService)
	);
	const nextChange = () =>
		new Promise<SettingsChangedEvent>((resolve) => {
			events.once(SettingsEvents.CHANGED, resolve);
		});
	return { stored, wake, service, changes, nextChange };
}

describe('SettingsService', () => {
	beforeEach(() => {
		mock.timers.enable({ apis: ['Date'] });
	});

	afterEach(() => {
		mock.timers.reset();
	});

	it('announces a new resourceVersion observed by the cache expiry without a wake', async () => {
		const { stored, service, changes } = harness();
		assert.equal((await service.get()).maintenanceMode, false);
		stored.change();
		assert.equal((await service.get()).maintenanceMode, false);
		assert.equal(changes.length, 0);

		mock.timers.tick(SETTINGS_CACHE_MAX_AGE_MILLISECONDS);
		assert.equal((await service.get()).maintenanceMode, true);
		assert.equal(changes.length, 1);
		assert.equal(
			changes[0]?.previous.resourceVersion,
			SETTINGS_RESOURCE_VERSION_INITIAL
		);
		assert.equal(changes[0]?.current.resourceVersion, CHANGED_VERSION);
		assert.equal(changes[0]?.changed('maintenanceMode'), true);
		assert.equal(changes[0]?.changed('publicIngressEnabled'), false);

		mock.timers.tick(SETTINGS_CACHE_MAX_AGE_MILLISECONDS);
		await service.get();
		assert.equal(changes.length, 1);
	});

	it('reloads immediately on the wake and announces the change once', async () => {
		const { stored, wake, service, changes, nextChange } = harness();
		await service.onModuleInit();
		assert.equal(wake.key, `${SETTINGS_WAKE.topic}:${SETTINGS_WAKE.id}`);
		await service.get();
		stored.change();

		const changed = nextChange();
		wake.listener?.();
		assert.equal((await changed).current.resourceVersion, CHANGED_VERSION);
		assert.equal((await service.get()).maintenanceMode, true);

		wake.listener?.();
		await service.get();
		assert.equal(changes.length, 1);
		service.onModuleDestroy();
		assert.equal(wake.listener, null);
	});
});
