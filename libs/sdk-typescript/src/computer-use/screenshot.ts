/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type ScreenshotResponse,
	type TakeCompressedScreenshotData,
	type TakeRegionScreenshotData,
	takeCompressedRegionScreenshot,
	takeCompressedScreenshot,
	takeRegionScreenshot,
	takeScreenshot,
} from '@snapflow/toolbox-api-client';
import type { ToolboxClientProvider } from '../edge-toolbox-session.js';

export type ScreenshotRegion = Pick<
	TakeRegionScreenshotData['query'],
	'x' | 'y' | 'width' | 'height'
>;

export type ScreenshotOptions = NonNullable<
	TakeCompressedScreenshotData['query']
>;

export class Screenshot {
	constructor(private readonly toolbox: ToolboxClientProvider) {}

	public async takeFullScreen(showCursor = false): Promise<ScreenshotResponse> {
		const response = await takeScreenshot({
			client: await this.toolbox(),
			query: { showCursor },
		});
		return response.data;
	}

	public async takeRegion(
		region: ScreenshotRegion,
		showCursor = false
	): Promise<ScreenshotResponse> {
		const response = await takeRegionScreenshot({
			client: await this.toolbox(),
			query: { ...region, showCursor },
		});
		return response.data;
	}

	public async takeCompressed(
		options: ScreenshotOptions = {}
	): Promise<ScreenshotResponse> {
		const response = await takeCompressedScreenshot({
			client: await this.toolbox(),
			query: options,
		});
		return response.data;
	}

	public async takeCompressedRegion(
		region: ScreenshotRegion,
		options: ScreenshotOptions = {}
	): Promise<ScreenshotResponse> {
		const response = await takeCompressedRegionScreenshot({
			client: await this.toolbox(),
			query: { ...options, ...region },
		});
		return response.data;
	}
}
