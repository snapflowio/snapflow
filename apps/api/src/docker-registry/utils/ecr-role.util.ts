/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ECR_CREDENTIALS } from '../constants/ecr-credentials.constants';
import type { DockerRegistry } from '../persistence/entities/docker-registry.entity';
import { registryHost } from '../persistence/utils/docker-registry-url.util';

export interface EcrRole {
	region: string;
	roleArn: string;
	accountId: string;
}

export interface EcrAuth {
	username: string;
	password: string;
}

export function ecrRoleOf(
	registry: Pick<DockerRegistry, 'url' | 'username'>
): EcrRole | null {
	const roleArn = registry.username.trim();
	const region = ECR_CREDENTIALS.HOST_PATTERN.exec(registryHost(registry.url))
		?.groups?.region;
	const accountId =
		ECR_CREDENTIALS.ROLE_ARN_PATTERN.exec(roleArn)?.groups?.accountId;
	if (!region || !accountId) return null;
	return { region, roleArn, accountId };
}

export function ecrTokenCacheKey(
	organizationId: string,
	role: EcrRole
): string {
	return [
		ECR_CREDENTIALS.TOKEN_CACHE_PREFIX,
		organizationId,
		role.roleArn,
		role.region,
	].join(ECR_CREDENTIALS.TOKEN_SEPARATOR);
}

export function ecrSessionName(organizationId: string): string {
	return `${ECR_CREDENTIALS.SESSION_NAME_PREFIX}${organizationId}${ECR_CREDENTIALS.SESSION_NAME_SUFFIX}`;
}

export function decodeEcrAuthorizationToken(token: string): EcrAuth {
	const decoded = Buffer.from(token, 'base64').toString('utf-8');
	const separator = decoded.indexOf(ECR_CREDENTIALS.TOKEN_SEPARATOR);
	if (separator < 0) {
		throw new Error('Unexpected ECR token format');
	}
	return {
		username: decoded.slice(0, separator),
		password: decoded.slice(separator + 1),
	};
}
