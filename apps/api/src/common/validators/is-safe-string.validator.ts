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
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

const HTML_TAG_PATTERN = /<[a-zA-Z/][^>]*>?/;

const URL_PATTERN =
	/https?:\/\/|ftps?:\/\/|sftp:\/\/|ssh:\/\/|wss?:\/\/|file:\/\/|ldaps?:\/\/|javascript:|data:|mailto:|tel:|www\./i;

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are precisely what this validator rejects.
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

@ValidatorConstraint({ async: false })
class IsSafeDisplayStringConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		if (value === undefined || value === null) {
			return true;
		}

		if (typeof value !== 'string') {
			return false;
		}

		if (HTML_TAG_PATTERN.test(value)) {
			return false;
		}

		if (URL_PATTERN.test(value)) {
			return false;
		}

		if (CONTROL_CHAR_PATTERN.test(value)) {
			return false;
		}

		return true;
	}

	defaultMessage(args?: import('class-validator').ValidationArguments): string {
		const field = args?.property ?? 'Value';
		return `${field} must not contain HTML tags, URLs, or control characters`;
	}
}

export function IsSafeDisplayString(
	validationOptions?: ValidationOptions
): PropertyDecorator {
	return (object: object, propertyName: string | symbol) => {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			constraints: [],
			validator: IsSafeDisplayStringConstraint,
		});
	};
}
