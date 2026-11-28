/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Attributes } from '@opentelemetry/api';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { observeOperation } from '../../../infra/logging/utils/operation-observability.util';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import type { Sandbox } from '../../entities/sandbox.entity';
import { SandboxCreatedEvent } from '../../events/sandbox-create.event';

@Injectable()
export class SandboxCreateNotifier {
	private readonly logger = new Logger(SandboxCreateNotifier.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly commitHooks: TransactionCommitHooks,
		private readonly eventEmitter: EventEmitter2
	) {}

	notifyCreated(sandbox: Sandbox, attributes: Attributes = {}): void {
		this.commitHooks.runAfterCommit(this.entityManager, () => {
			observeOperation('sandbox.job.create_notify', attributes, () =>
				this.eventEmitter.emitAsync(
					SandboxEvents.CREATED,
					new SandboxCreatedEvent(sandbox)
				)
			).catch((error: unknown) =>
				this.logger.error('Failed to emit SandboxCreatedEvent', error)
			);
		});
	}
}
