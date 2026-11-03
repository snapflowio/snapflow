/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Logger } from '@nestjs/common';
import { errorStack } from '../utils/error/error.util';

const SLOW_EXECUTION_MILLISECONDS = 1_000;

export function LogExecution(name?: string) {
	return (
		target: object,
		propertyKey: PropertyKey,
		descriptor: PropertyDescriptor
	) => {
		const originalMethod = descriptor.value;
		if (typeof originalMethod !== 'function') {
			throw new TypeError('@LogExecution can only decorate methods');
		}
		const logger = new Logger(`Function:${target.constructor.name}`);
		const functionName = name ?? String(propertyKey);

		descriptor.value = async function (...args: unknown[]) {
			const startTime = Date.now();
			try {
				const result = await originalMethod.apply(this, args);
				const duration = Date.now() - startTime;
				if (duration > SLOW_EXECUTION_MILLISECONDS) {
					logger.debug(`Function ${functionName} took ${duration}ms`);
				}
				return result;
			} catch (error) {
				logger.debug(
					`Failed function: ${functionName} (took ${Date.now() - startTime}ms)`,
					errorStack(error)
				);
				throw error;
			}
		};

		return descriptor;
	};
}
