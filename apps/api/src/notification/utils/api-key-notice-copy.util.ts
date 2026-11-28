/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { FUNDING_POLICY } from '../../billing/constants/funding.constants';
import type { ApiKeyBudgetExhaustedEvent } from '../../billing/events/api-key-budget-exhausted.event';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { DASHBOARD_NOTICE_PATH } from '../constants/notice.constants';
import type { NoticeCopy } from '../types/notice.types';

const UNNAMED_API_KEY = 'An API key';

function sandboxCount(count: number): string {
	return `${count} sandbox${count === 1 ? '' : 'es'}`;
}

export function apiKeyBudgetNoticeCopy(
	organizationName: string,
	apiKeyName: string | null,
	event: ApiKeyBudgetExhaustedEvent
): NoticeCopy {
	const keyName = apiKeyName ?? UNNAMED_API_KEY;
	return {
		subject: `${organizationName}: ${keyName} reached its compute spend limit`,
		heading: `${keyName} reached its compute spend limit`,
		paragraphs: [
			`${keyName} in ${organizationName} has nearly spent its compute limit of $${MicroUsd.parse(event.computeSpendLimitMicroUsd).toUsd()} over the last ${FUNDING_POLICY.apiKeyBudgetWindowDays} days.`,
			`Snapflow stopped ${sandboxCount(event.stoppedSandboxes)} it started before they could pass the limit, and it cannot start new ones. Their disks stay billed to the organization until they are archived or deleted.`,
		],
		note: 'Raise or remove the compute spend limit to start sandboxes with this key again.',
		action: { label: 'Review API keys', path: DASHBOARD_NOTICE_PATH.API_KEYS },
	};
}
