/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_PROOF_HEADER = 'dpop';
export const MACHINE_AUTHORIZATION_SCHEME = 'DPoP';
export const MACHINE_SESSION_TOKEN_BYTES = 32;
export const MACHINE_SESSION_TOKEN_HASH_ALGORITHM = 'sha256';
export const MACHINE_SESSION_DURATION_MS = 5 * 60 * 1_000;
export const MACHINE_PROOF_TYPE = 'dpop+jwt';
export const MACHINE_PROOF_ALGORITHM = 'EdDSA';
export const MACHINE_PROOF_MAX_AGE_SECONDS = 60;
export const MACHINE_PROOF_FUTURE_SKEW_SECONDS = 5;
export const MACHINE_PROOF_REPLAY_KEY_PREFIX = 'snapflow:dpop:jti:';
export const MACHINE_PROOF_MAX_LENGTH = 4_096;
export const MACHINE_PROOF_JTI_MAX_LENGTH = 128;
