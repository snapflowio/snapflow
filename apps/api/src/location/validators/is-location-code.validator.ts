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
import { isLocationCode } from '../utils/location-constraint.util';

@ValidatorConstraint({ async: false })
class IsLocationCodeConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return typeof value === 'string' && isLocationCode(value);
	}

	defaultMessage(args?: ValidationArguments): string {
		return `${args?.property ?? 'Location'} must name a continent (e.g. europe) or an ISO 3166-1 alpha-2 country code (e.g. DE)`;
	}
}

export function IsLocationCode(
	validationOptions?: ValidationOptions
): PropertyDecorator {
	return (object: object, propertyName: string | symbol) => {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			constraints: [],
			validator: IsLocationCodeConstraint,
		});
	};
}
