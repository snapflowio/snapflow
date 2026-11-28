/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

const ALPHANUMERIC = '[a-z0-9]+';
const PATH_COMPONENT = `${ALPHANUMERIC}(?:(?:[._]|__|[-]+)${ALPHANUMERIC})*`;
const DOMAIN_COMPONENT = '(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])';
const DOMAIN = `(?:${DOMAIN_COMPONENT}(?:\\.${DOMAIN_COMPONENT})*|\\[[a-fA-F0-9:]+\\])(?::[0-9]+)?`;
const REFERENCE_PATTERN = new RegExp(
	`^(?:${DOMAIN}/)?${PATH_COMPONENT}(?:/${PATH_COMPONENT})*(?::(?<tag>[\\w][\\w.-]{0,127}))?(?:@(?<digest>(?:sha256:[a-f0-9]{64}|sha384:[a-f0-9]{96}|sha512:[a-f0-9]{128})))?$`
);
const DOMAIN_PATTERN = new RegExp(`^${DOMAIN}$`);
const LOCALHOST = 'localhost';
const LATEST_TAG = 'latest';

interface ImageReferenceParts {
	tag?: string;
	digest?: string;
}

function parseImageReference(value: string): ImageReferenceParts | null {
	const separator = value.indexOf('/');
	const domain = separator === -1 ? '' : value.slice(0, separator);
	const explicitDomain =
		/[.:]/.test(domain) ||
		domain === LOCALHOST ||
		domain.toLowerCase() !== domain;
	if (explicitDomain && !DOMAIN_PATTERN.test(domain)) return null;
	const match = REFERENCE_PATTERN.exec(value);
	if (!match) return null;
	const { tag, digest } = match.groups ?? {};
	return { tag, digest };
}

export const containerImageReferenceSchema = z
	.string()
	.trim()
	.superRefine((value, context) => {
		if (!value) {
			context.addIssue({
				code: 'custom',
				message: 'Enter a tagged container image, such as ubuntu:24.04',
			});
			return;
		}
		const reference = parseImageReference(value);
		if (!reference) {
			context.addIssue({
				code: 'custom',
				message:
					'Enter a valid container image reference, such as registry.example.com:5000/team/app:1.0 or ubuntu@sha256:…',
			});
			return;
		}
		if (!reference.tag && !reference.digest) {
			context.addIssue({
				code: 'custom',
				message: 'Add a fixed tag, such as :24.04, or use a sha256 digest',
			});
			return;
		}
		if (!reference.digest && reference.tag === LATEST_TAG) {
			context.addIssue({
				code: 'custom',
				message: 'Use a fixed image tag instead of :latest',
			});
		}
	});
