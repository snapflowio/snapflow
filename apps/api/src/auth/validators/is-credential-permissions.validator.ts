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
import { isCredentialPermissions } from '../../organization/utils/organization-permissions.util';

@ValidatorConstraint({ async: false })
class IsCredentialPermissionsConstraint
	implements ValidatorConstraintInterface
{
	validate(value: unknown): boolean {
		return isCredentialPermissions(value);
	}

	defaultMessage(args?: ValidationArguments): string {
		return `${args?.property ?? 'permissions'} must grant at least one assignable action per listed resource, without duplicates`;
	}
}

export function IsCredentialPermissions(
	validationOptions?: ValidationOptions
): PropertyDecorator {
	return (object: object, propertyName: string | symbol) => {
		registerDecorator({
			target: object.constructor,
			propertyName: String(propertyName),
			options: validationOptions,
			constraints: [],
			validator: IsCredentialPermissionsConstraint,
		});
	};
}
