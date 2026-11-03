/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CallHandler,
	ExecutionContext,
	Injectable,
	Logger,
	NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ContentTypeInterceptor implements NestInterceptor {
	private readonly logger = new Logger(ContentTypeInterceptor.name);

	async intercept(
		context: ExecutionContext,
		next: CallHandler
	): Promise<Observable<unknown>> {
		const request = context.switchToHttp().getRequest();

		if (request.readable) {
			const contentType = request.get('content-type') || '';
			const isJsonContentType =
				!contentType ||
				contentType.toLowerCase().includes('application/json') ||
				contentType.toLowerCase().includes('text/json');

			if (!isJsonContentType) {
				return next.handle();
			}

			await new Promise<void>((resolve, reject) => {
				let rawBody = '';

				request.on('data', (chunk: Buffer) => {
					rawBody += chunk.toString();
				});

				request.on('end', () => {
					try {
						if (rawBody) {
							request.body = JSON.parse(rawBody);
							request.headers['content-type'] = 'application/json';
						}
						resolve();
					} catch (e) {
						this.logger.warn('Failed to parse JSON body:', e);
						resolve();
					}
				});

				request.on('error', (error: Error) => {
					this.logger.error('Error reading request body:', error);
					reject(error);
				});
			});
		}

		if (
			request.body &&
			Object.keys(request.body).length > 0 &&
			!request.get('content-type')
		) {
			request.headers['content-type'] = 'application/json';
		}

		return next.handle();
	}
}
