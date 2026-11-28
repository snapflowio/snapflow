/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum DockerRegistryErrorCode {
	NOT_FOUND = 'docker_registry_not_found',
	LIMIT_REACHED = 'docker_registry_limit_reached',
	UNAVAILABLE = 'docker_registry_unavailable',
	ROLE_VERIFICATION_UNAVAILABLE = 'docker_registry_role_verification_unavailable',
}
