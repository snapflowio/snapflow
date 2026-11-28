/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AuthContext, BetterAuthOptions } from '@better-auth/core';
import {
	getCurrentAdapter,
	runWithTransaction,
} from '@better-auth/core/context';
import type { DBTransactionAdapter } from '@better-auth/core/db/adapter';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DELETED_ORGANIZATION_SLUG_PREFIX } from '@snapflow/organization-access';
import { OrganizationEvents } from '../constants/organization-events.constants';
import { OrganizationDeletedEvent } from '../events/organization-deleted.event';

type OrganizationDeletionContext<Options extends BetterAuthOptions> = Pick<
	AuthContext<Options>,
	'adapter' | 'internalAdapter'
>;

const ORGANIZATION_MODEL = 'organization';
const SESSION_MODEL = 'session';
const ACTIVE_ORGANIZATION_FIELD = 'activeOrganizationId';
const ORGANIZATION_SESSION_BATCH_SIZE = 100;
const ORGANIZATION_ACCESS_MODELS = [
	{ model: 'member', field: 'organizationId' },
	{ model: 'invitation', field: 'organizationId' },
	{ model: 'organizationRole', field: 'organizationId' },
	{ model: 'apikey', field: 'referenceId' },
] as const;

function deletedOrganizationSlug(organizationId: string): string {
	return `${DELETED_ORGANIZATION_SLUG_PREFIX}${organizationId}`;
}

export async function softDeleteOrganization<Options extends BetterAuthOptions>(
	context: OrganizationDeletionContext<Options>,
	eventEmitter: Pick<EventEmitter2, 'emitAsync'>,
	organizationId: string
): Promise<void> {
	await runWithTransaction(context.adapter, async () => {
		const adapter = await getCurrentAdapter(context.adapter);
		await adapter.update({
			model: ORGANIZATION_MODEL,
			where: [{ field: 'id', value: organizationId }],
			update: {
				deletedAt: new Date(),
				slug: deletedOrganizationSlug(organizationId),
			},
		});
		for (const { model, field } of ORGANIZATION_ACCESS_MODELS) {
			await adapter.deleteMany({
				model,
				where: [{ field, value: organizationId }],
			});
		}
		await clearActiveOrganization(context, adapter, organizationId);
	});
	await eventEmitter.emitAsync(
		OrganizationEvents.DELETED,
		new OrganizationDeletedEvent(organizationId)
	);
}

async function clearActiveOrganization<Options extends BetterAuthOptions>(
	context: OrganizationDeletionContext<Options>,
	adapter: DBTransactionAdapter<Options>,
	organizationId: string
): Promise<void> {
	let sessions: { token: string }[];
	do {
		sessions = await adapter.findMany<{ token: string }>({
			model: SESSION_MODEL,
			where: [{ field: ACTIVE_ORGANIZATION_FIELD, value: organizationId }],
			limit: ORGANIZATION_SESSION_BATCH_SIZE,
		});
		for (const { token } of sessions) {
			await context.internalAdapter.updateSession(token, {
				[ACTIVE_ORGANIZATION_FIELD]: null,
			});
		}
	} while (sessions.length === ORGANIZATION_SESSION_BATCH_SIZE);
}
