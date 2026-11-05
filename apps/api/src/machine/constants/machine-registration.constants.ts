/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_IDENTITY_KEY_PREFIX = 'ed25519:';
export const MACHINE_IDENTITY_KEY_TYPE = 'ed25519';
export const MACHINE_IDENTITY_PUBLIC_KEY_MAX_LENGTH = 1_024;
export const MACHINE_REGISTRATION_PROOF_DOMAIN =
	'snapflow.machine-registration';
export const MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS =
	5 * 60 * 1_000;
export const MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES = 16;
export const MACHINE_REGISTRATION_SIGNATURE_BYTES = 64;
export const MACHINE_REGISTRATION_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{86}$/;
export const MACHINE_REGISTRATION_NONCE_PATTERN = /^[A-Za-z0-9_-]+$/;
export const MACHINE_REGISTRATION_APP_VERSION_MAX_LENGTH = 128;
