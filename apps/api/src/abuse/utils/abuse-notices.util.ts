/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Machine } from '../../machine/entities/machine.entity';
import {
	AbuseNoticeAudience,
	type AbuseNoticeKind,
	HOST_ONLY_ABUSE_NOTICE_KINDS,
} from '../../notification/constants/notice.constants';
import { AbuseNoticeEvent } from '../../notification/events/abuse-notice.event';
import {
	enqueueAbuseNotice,
	noticeKey,
} from '../../notification/utils/notice-outbox.util';
import { ABUSE_NOTICE_KEY_PREFIX } from '../constants/abuse.constants';
import type { AbuseReportCategory } from '../constants/abuse-report.constants';
import type { AbuseCase } from '../entities/abuse-case.entity';
import { findingKinds } from './abuse-ladder.util';

export async function enqueueAbuseCaseNotices(
	manager: EntityManager,
	abuseCase: Pick<
		AbuseCase,
		'id' | 'sandboxId' | 'organizationId' | 'machineId' | 'findings'
	>,
	sandboxName: string,
	kind: AbuseNoticeKind,
	category: AbuseReportCategory | null,
	observedAt: Date
): Promise<void> {
	const machine = abuseCase.machineId
		? await manager.findOne(
				Machine,
				{ id: abuseCase.machineId },
				{ fields: ['organizationId', 'name'] }
			)
		: null;
	const notice = {
		kind,
		caseId: abuseCase.id,
		category,
		sandboxId: abuseCase.sandboxId,
		sandboxName,
		machineId: machine?.id ?? null,
		machineName: machine?.name ?? null,
		signals: findingKinds(abuseCase.findings),
	};
	const audiences = [
		...(HOST_ONLY_ABUSE_NOTICE_KINDS.has(kind)
			? []
			: [
					{
						audience: AbuseNoticeAudience.CUSTOMER,
						organizationId: abuseCase.organizationId,
					},
				]),
		...(machine
			? [
					{
						audience: AbuseNoticeAudience.HOST,
						organizationId: machine.organizationId,
					},
				]
			: []),
	];
	for (const { audience, organizationId } of audiences) {
		await enqueueAbuseNotice(
			manager,
			new AbuseNoticeEvent(
				organizationId,
				noticeKey(ABUSE_NOTICE_KEY_PREFIX, abuseCase.id, kind, audience),
				{ ...notice, audience },
				observedAt
			)
		);
	}
}
