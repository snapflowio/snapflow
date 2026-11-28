/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ApiOperation } from '@nestjs/swagger';

export const PUBLIC_ENDPOINT_KEY = Symbol('public-endpoint');

export function PublicEndpoint(): ClassDecorator & MethodDecorator {
	return (
		target: object,
		propertyKey?: string | symbol,
		descriptor?: PropertyDescriptor
	): void => {
		if (descriptor && propertyKey !== undefined) {
			SetMetadata(PUBLIC_ENDPOINT_KEY, true)(target, propertyKey, descriptor);
			ApiOperation({ security: [] })(target, propertyKey, descriptor);
			return;
		}

		Reflect.defineMetadata(PUBLIC_ENDPOINT_KEY, true, target);
		if (typeof target !== 'function') return;
		for (const key of Object.getOwnPropertyNames(target.prototype)) {
			const route = Object.getOwnPropertyDescriptor(target.prototype, key);
			if (!route?.value || !Reflect.hasMetadata(METHOD_METADATA, route.value)) {
				continue;
			}
			ApiOperation({ security: [] })(target.prototype, key, route);
		}
	};
}

export function isPublicEndpoint(
	context: ExecutionContext,
	reflector: Reflector
): boolean {
	return (
		reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT_KEY, [
			context.getHandler(),
			context.getClass(),
		]) ?? false
	);
}
