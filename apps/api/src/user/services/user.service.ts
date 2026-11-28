/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { apiError } from '../../common/utils/error/api-error.util';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/constants/legal-documents.constants';
import { assertCurrentVersion } from '../../legal/utils/legal-version.util';
import { UserEvents } from '../constants/user-events.constants';
import { User } from '../entities/user.entity';
import { SystemRole } from '../enums/system-role.enum';
import { UserErrorCode } from '../enums/user-error-code.enum';
import { UserAuthorizationChangedEvent } from '../events/user-authorization-changed.event';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { releaseRestrictedEvidenceAccess } from '../utils/restricted-evidence-holder.util';
import { generateSshKeyPair } from '../utils/ssh-key-pair.util';
import { isBanActive } from '../utils/user-ban.util';
import { userNotFound } from '../utils/user-error.util';

@Injectable()
export class UserService {
	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly entityManager: EntityManager
	) {}

	async findOldestAdministrator(): Promise<User | null> {
		return this.entityManager.findOne(
			User,
			{ role: SystemRole.ADMIN, banned: false },
			{ orderBy: { createdAt: 'ASC' } }
		);
	}

	async findByIds(ids: string[]): Promise<User[]> {
		if (ids.length === 0) return [];
		return this.entityManager.find(User, { id: { $in: ids } });
	}

	findOne(id: string): Promise<User | null> {
		return this.entityManager.findOne(User, { id });
	}

	findOneOrFail(id: string): Promise<User> {
		return this.entityManager.findOneOrFail(User, { id });
	}

	findOneByEmail(email: string): Promise<User | null> {
		return this.entityManager.findOne(User, { email: email.toLowerCase() });
	}

	async updateName(userId: string, name: string): Promise<User> {
		const user = await this.findUserOrFail(userId);
		user.name = name;
		await this.entityManager.flush();
		return user;
	}

	async updateEmail(userId: string, email: string): Promise<User> {
		const user = await this.findUserOrFail(userId);
		user.email = email.toLowerCase();
		await this.entityManager.flush();
		return user;
	}

	async hasRestrictedEvidenceHolder(): Promise<boolean> {
		return (
			(await this.entityManager.count(User, {
				restrictedEvidenceAccess: true,
			})) > 0
		);
	}

	async provisionAdministrator(userId: string): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const user = await manager.findOneOrFail(User, { id: userId });
				user.role = SystemRole.ADMIN;
				user.emailVerified = true;
				user.restrictedEvidenceAccess = true;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		this.eventEmitter.emit(
			UserEvents.AUTHORIZATION_CHANGED,
			new UserAuthorizationChangedEvent(userId)
		);
	}

	releaseRestrictedEvidenceAccess(userId: string): Promise<boolean> {
		return this.entityManager
			.fork()
			.transactional((manager) =>
				releaseRestrictedEvidenceAccess(manager, userId)
			);
	}

	async completeAuthenticationProvisioning(
		userId: string,
		acceptedTermsAtSignup: boolean
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const user = await manager.findOneOrFail(User, { id: userId });
				user.keyPair ??= await generateSshKeyPair();
				if (acceptedTermsAtSignup) {
					recordTermsAcceptance(user, LEGAL_DOCUMENT_VERSION.TERMS);
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async assertActive(userId: string): Promise<User> {
		const user = await this.findUserOrFail(userId);
		if (isBanActive(user)) {
			throw new ForbiddenException(
				apiError(
					UserErrorCode.ACCOUNT_SUSPENDED,
					user.banReason
						? `Your account is suspended. Reason: ${user.banReason}. Contact support@snapflow.io to appeal.`
						: 'Your account is suspended. Contact support@snapflow.io to appeal.'
				)
			);
		}
		return user;
	}

	async notifyAuthenticationDeleted(userId: string): Promise<void> {
		await this.entityManager.transactional(
			(manager) =>
				this.eventEmitter.emitAsync(
					UserEvents.DELETED,
					new UserDeletedEvent(manager, userId)
				),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async findUserOrFail(id: string): Promise<User> {
		const user = await this.findOne(id);
		if (!user) throw new NotFoundException(userNotFound(id));
		return user;
	}

	async acceptTerms(userId: string, version: string): Promise<User> {
		assertCurrentVersion(version, LEGAL_DOCUMENT_VERSION.TERMS);
		const user = await this.entityManager.findOne(User, { id: userId });
		if (!user) throw new NotFoundException(userNotFound(userId));
		recordTermsAcceptance(user, version);
		await this.entityManager.flush();
		return user;
	}
}

function recordTermsAcceptance(user: User, version: string): void {
	user.acceptedTermsVersion = version;
	user.termsAcceptedAt = new Date();
}
