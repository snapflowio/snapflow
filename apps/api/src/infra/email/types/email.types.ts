/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Resend } from 'resend';

export interface EmailBrand {
	readonly websiteUrl: string;
}

export type ResendEmails = Pick<Resend['emails'], 'send'>;

export interface EmailDelivery {
	readonly emails: ResendEmails;
	readonly from: string;
	readonly replyTo: string | undefined;
	readonly brand: EmailBrand;
}
