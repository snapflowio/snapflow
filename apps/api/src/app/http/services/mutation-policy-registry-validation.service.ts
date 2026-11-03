/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Injectable,
	type OnApplicationBootstrap,
	RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
	MUTATION_POLICY_ENTRY_COUNT,
	MUTATION_POLICY_REGISTRY,
} from '../../../idempotency/request/handlers/mutation-policy.registry';
import { registryMismatch } from '../utils/mutation-policy-registry.util';

const READ_ONLY_METHODS: ReadonlySet<RequestMethod> = new Set([
	RequestMethod.GET,
	RequestMethod.HEAD,
	RequestMethod.OPTIONS,
]);

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
		const mismatch = registryMismatch(
			this.discoverPolicyHandlers(),
			new Set(MUTATION_POLICY_REGISTRY.keys()),
			MUTATION_POLICY_ENTRY_COUNT
		);
		if (mismatch) throw new Error(mismatch);
	}

	private discoverPolicyHandlers(): ReadonlySet<string> {
		return new Set(
			this.discovery.getControllers().flatMap(({ metatype }) => {
				if (!metatype) return [];
				const prototype: object = metatype.prototype;
				return this.scanner
					.getAllMethodNames(prototype)
					.map((handlerName) => ({
						key: `${metatype.name}.${handlerName}`,
						method: this.reflector.get<RequestMethod | undefined>(
							METHOD_METADATA,
							Reflect.get(prototype, handlerName)
						),
					}))
					.filter(
						({ key, method }) =>
							method !== undefined &&
							(!READ_ONLY_METHODS.has(method) ||
								MUTATION_POLICY_REGISTRY.has(key))
					)
					.map(({ key }) => key);
			})
		);
	}
}
