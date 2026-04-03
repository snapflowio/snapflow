/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/**
 * Regex pattern for validating Docker image names
 * Allows: letters, numbers, dots, dashes, colons, and slashes
 * Example: ubuntu:22.04, my-org/my-image:v1.0
 */
export const IMAGE_NAME_REGEX = /^[a-zA-Z0-9.\-:]+(\/[a-zA-Z0-9.\-:]+)*$/;

/**
 * Validation result type
 */
export type ValidationResult = {
	isValid: boolean;
	error: string | null;
};

/**
 * Validate a Docker image name
 * @param name - The image name to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageName(name: string): ValidationResult {
	if (!name || name.trim() === '') {
		return {
			isValid: false,
			error: 'Image name is required',
		};
	}

	if (name.includes(' ')) {
		return {
			isValid: false,
			error: 'Spaces are not allowed in image names',
		};
	}

	if (!name.includes(':') || name.endsWith(':') || /:\s*$/.test(name)) {
		return {
			isValid: false,
			error: 'Image name must include a tag (e.g., ubuntu:22.04)',
		};
	}

	if (name.endsWith(':latest')) {
		return {
			isValid: false,
			error: 'Images with tag ":latest" are not allowed',
		};
	}

	if (!IMAGE_NAME_REGEX.test(name)) {
		return {
			isValid: false,
			error:
				'Invalid image name format. May contain letters, digits, dots, colons, slashes and dashes',
		};
	}

	return {
		isValid: true,
		error: null,
	};
}

/**
 * Check if an image name is valid (simple boolean check)
 * @param name - The image name to validate
 * @returns true if valid, false otherwise
 */
export function isValidImageName(name: string): boolean {
	return validateImageName(name).isValid;
}
