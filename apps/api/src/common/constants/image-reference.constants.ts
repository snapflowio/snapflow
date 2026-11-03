/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const ALPHANUMERIC = '[a-z0-9]+';
const SEPARATOR = '(?:[._]|__|[-]+)';
const PATH_COMPONENT = `${ALPHANUMERIC}(?:${SEPARATOR}${ALPHANUMERIC})*`;
const DOMAIN_COMPONENT = '(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])';
const DOMAIN_NAME = `${DOMAIN_COMPONENT}(?:\\.${DOMAIN_COMPONENT})*`;
const IPV6_ADDRESS = '\\[[a-fA-F0-9:]+\\]';
const DOMAIN = `(?:${DOMAIN_NAME}|${IPV6_ADDRESS})(?::[0-9]+)?`;
const TAG = '[\\w][\\w.-]{0,127}';
const DIGEST =
	'[A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*:[0-9a-fA-F]{32,}';

const PATH = `${PATH_COMPONENT}(?:/${PATH_COMPONENT})*`;

export const QUALIFIED_IMAGE_REFERENCE_PATTERN = new RegExp(
	`^(?<domain>${DOMAIN})/(?<path>${PATH})(?::(?<tag>${TAG}))?(?:@(?<digest>${DIGEST}))?$`
);

export const IMAGE_REFERENCE_LIMITS = {
	maximumNameLength: 255,
} as const;

export const DOCKER_HUB_REFERENCE = {
	domain: 'docker.io',
	indexDomain: 'index.docker.io',
	officialRepositoryPrefix: 'library/',
	localhost: 'localhost',
} as const;

export const IMAGE_DIGEST_HEX_LENGTHS: ReadonlyMap<string, number> = new Map([
	['sha256', 64],
	['sha384', 96],
	['sha512', 128],
]);

export const LATEST_IMAGE_TAG = 'latest';
