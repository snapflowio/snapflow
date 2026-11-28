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
import type { WebhookPublication } from '../types/webhook-payload.types';
import { publishWebhook } from '../utils/webhook-publish.util';

@Injectable()
export class WebhookPublisherService {
	constructor(private readonly entityManager: EntityManager) {}

	publish(publication: WebhookPublication): Promise<void> {
		return publishWebhook(this.entityManager.fork(), publication);
	}
}
