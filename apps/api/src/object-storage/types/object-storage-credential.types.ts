/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface ObjectUploadGrant {
	keys: readonly string[];
	ttlSeconds: number;
}

export interface StaticObjectStorageCredential {
	accessKeyId: string;
	secretAccessKey: string;
}

export interface ObjectStorageCredential extends StaticObjectStorageCredential {
	sessionToken: string;
	expiresAt: Date;
}
