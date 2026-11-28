/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
	MUTATION_POLICY_ENTRY_COUNT,
	MUTATION_POLICY_REGISTRY,
} from '../handlers/mutation-policy.registry';
import {
	policyHandlerKeys,
	registryMismatch,
} from '../utils/mutation-policy-registry.util';

@Injectable()
export class MutationPolicyRegistryValidationService
	implements OnApplicationBootstrap
{
	constructor(
		private readonly discovery: DiscoveryService,
		private readonly scanner: MetadataScanner,
		private readonly reflector: Reflector
	) {}

	onApplicationBootstrap(): void {
		const registered = new Set(MUTATION_POLICY_REGISTRY.keys());
		const controllers = this.discovery
			.getControllers()
			.flatMap(({ metatype }) => (metatype ? [metatype] : []));
		const mismatch = registryMismatch(
			policyHandlerKeys(controllers, registered, this.scanner, this.reflector),
			registered,
			MUTATION_POLICY_ENTRY_COUNT
		);
		if (mismatch) throw new Error(mismatch);
	}
}
