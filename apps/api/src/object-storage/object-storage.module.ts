/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObjectStorageController } from './controllers/object-storage.controller';
import { BuildContextUploadService } from './services/build-context-upload.service';
import { ObjectStorageService } from './services/object-storage.service';
import { ObjectStorageCredentialService } from './services/object-storage-credential.service';

@Module({
	imports: [ConfigModule],
	controllers: [ObjectStorageController],
	providers: [
		ObjectStorageService,
		ObjectStorageCredentialService,
		BuildContextUploadService,
	],
	exports: [ObjectStorageService, ObjectStorageCredentialService],
})
export class ObjectStorageModule {}
