/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	HttpStatus,
	Module,
	OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
@Module({})
export class BodyParserErrorModule implements OnModuleInit {
	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	onModuleInit() {
		const app = this.httpAdapterHost.httpAdapter.getInstance();

		app.use(
			(
				err: Error & { body?: unknown },
				_req: Request,
				res: Response,
				next: NextFunction
			) => {
				if (err instanceof SyntaxError && 'body' in err) {
					const response = new BadRequestException(
						'Invalid JSON in request body'
					).getResponse();
					return res.status(HttpStatus.BAD_REQUEST).json(response);
				}

				next(err);
			}
		);
	}
}
