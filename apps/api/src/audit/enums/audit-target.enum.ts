/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum AuditTarget {
	DOCKER_REGISTRY = 'docker_registry',
	MACHINE = 'machine',
	ABUSE_CASE = 'abuse_case',
	ABUSE_REPORT = 'abuse_report',
	PRICE_SUGGESTION = 'price_suggestion',
	SANDBOX = 'sandbox',
	SNAPSHOT = 'snapshot',
	USER = 'user',
	VOLUME = 'volume',
	BILLING = 'billing',
	PAYMENT_WALLET = 'payment_wallet',
	PAYMENT_CHANNEL = 'payment_channel',
	SECRET = 'secret',
	SETTINGS = 'settings',
	API_KEY = 'api_key',
	ORGANIZATION = 'organization',
	WEBHOOK_ENDPOINT = 'webhook_endpoint',
	WEBHOOK_DELIVERY = 'webhook_delivery',
}
