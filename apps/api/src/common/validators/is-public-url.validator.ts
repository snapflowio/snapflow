/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
} from 'class-validator';
import { isPublicHost } from '../utils/ip-address.util';

@ValidatorConstraint({ async: false })
class IsPublicUrlConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		if (value === undefined || value === null) return true;
		return (
			typeof value === 'string' &&
			URL.canParse(value) &&
			isPublicHost(new URL(value).host)
		);
	}

	defaultMessage(args?: ValidationArguments): string {
		const field = args?.property ?? 'Value';
		return `${field} must point at a public host, not localhost, a private network or a link-local address`;
	}
}

export function IsPublicUrl(
	validationOptions?: ValidationOptions
): PropertyDecorator {
	return (object: object, propertyName: string | symbol) => {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName.toString(),
			options: validationOptions,
			constraints: [],
			validator: IsPublicUrlConstraint,
		});
	};
}
