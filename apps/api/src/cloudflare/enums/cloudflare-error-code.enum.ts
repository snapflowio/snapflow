/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum CloudflareErrorCode {
	INGRESS_UNAVAILABLE = 'ingress_unavailable',
	DNS_RECORD_CONFLICT = 'dns_record_conflict',
	CUSTOM_HOSTNAME_CONFLICT = 'custom_hostname_conflict',
	WEBHOOK_UNAUTHORIZED = 'cloudflare_webhook_unauthorized',
}
