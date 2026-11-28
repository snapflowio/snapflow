/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionCommitHooks } from '../subscribers/transaction-commit-hooks.subscriber';

@Injectable()
export class CommittedEventPublisher {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly commitHooks: TransactionCommitHooks,
		private readonly eventEmitter: EventEmitter2
	) {}

	publish(event: string, payload: object): void {
		this.commitHooks.runAfterCommit(this.entityManager, () => {
			this.eventEmitter.emit(event, payload);
		});
	}
}
