/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TypedConfigService } from '../../config/services/typed-config.service';

@Injectable()
export class VersionHeaderMiddleware implements NestMiddleware {
	private readonly version: string | undefined;

	constructor(private readonly configService: TypedConfigService) {
		this.version = this.configService.get('version');
	}

	use(_req: Request, res: Response, next: NextFunction) {
		if (this.version) {
			res.setHeader('X-Snapflow-Api-Version', `${this.version}`);
		}
		next();
	}
}
