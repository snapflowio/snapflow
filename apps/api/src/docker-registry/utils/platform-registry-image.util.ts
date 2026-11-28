/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ImageReference } from '../../common/values/image-reference.value';
import { registryHost } from './docker-registry-url.util';
import { isRegistryPushImage } from './registry-token-scope.util';

export function isForeignPlatformRegistryImage(
	imageName: string,
	platformRegistryUrls: readonly string[],
	organizationId: string
): boolean {
	const image = ImageReference.parse(imageName);
	if (image.isDockerHub) {
		return false;
	}
	const host = image.domain.toLowerCase();
	const onPlatformRegistry = platformRegistryUrls.some(
		(url) => registryHost(url).toLowerCase() === host
	);
	return (
		onPlatformRegistry && !isRegistryPushImage(imageName, host, organizationId)
	);
}
