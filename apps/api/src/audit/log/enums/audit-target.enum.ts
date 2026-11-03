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
	MARKET_REFERENCE_PRICE = 'market_reference_price',
	SANDBOX = 'sandbox',
	SNAPSHOT = 'snapshot',
	USER = 'user',
	VOLUME = 'volume',
	BILLING = 'billing',
	SECRET = 'secret',
	SETTINGS = 'settings',
	API_KEY = 'api_key',
	ORGANIZATION = 'organization',
}
