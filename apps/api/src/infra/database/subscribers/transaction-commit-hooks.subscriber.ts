/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { EventSubscriber, TransactionEventArgs } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

type CommitAction = () => void;
type TransactionHandle = object;

const runDetached = AsyncLocalStorage.snapshot();

@Injectable()
export class TransactionCommitHooks implements EventSubscriber {
	private readonly openingParents = new WeakMap<object, TransactionHandle>();
	private readonly parents = new WeakMap<
		TransactionHandle,
		TransactionHandle
	>();
	private readonly pending = new WeakMap<TransactionHandle, CommitAction[]>();

	constructor(entityManager: EntityManager) {
		entityManager.getEventManager().registerSubscriber(this);
	}

	runAfterCommit(manager: EntityManager, action: CommitAction): void {
		const transaction: TransactionHandle | undefined = manager
			.getContext(false)
			.getTransactionContext();
		if (!transaction) {
			runDetached(action);
			return;
		}
		this.append(transaction, [action]);
	}

	beforeTransactionStart({ em, transaction }: TransactionEventArgs): void {
		if (transaction) this.openingParents.set(em, transaction);
	}

	afterTransactionStart({ em, transaction }: TransactionEventArgs): void {
		const parent = this.openingParents.get(em);
		this.openingParents.delete(em);
		if (parent && transaction) this.parents.set(transaction, parent);
	}

	afterTransactionCommit({ transaction }: TransactionEventArgs): void {
		if (!transaction) return;
		const actions = this.pending.get(transaction);
		this.pending.delete(transaction);
		if (!actions) return;
		const parent = this.parents.get(transaction);
		if (parent) {
			this.append(parent, actions);
			return;
		}
		for (const action of actions) runDetached(action);
	}

	afterTransactionRollback({ transaction }: TransactionEventArgs): void {
		if (transaction) this.pending.delete(transaction);
	}

	private append(
		transaction: TransactionHandle,
		actions: readonly CommitAction[]
	): void {
		const existing = this.pending.get(transaction) ?? [];
		existing.push(...actions);
		this.pending.set(transaction, existing);
	}
}
