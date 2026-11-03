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
	click,
	drag,
	getMousePosition,
	type MouseClickResponse,
	type MouseDragResponse,
	type MousePositionResponse,
	type MouseScrollRequest,
	moveMouse,
	scroll,
} from '@snapflow/toolbox-api-client';
import type { ToolboxClientProvider } from '../edge-toolbox-session.js';

const DEFAULT_MOUSE_BUTTON = 'left';

export class Mouse {
	constructor(private readonly toolbox: ToolboxClientProvider) {}

	public async getPosition(): Promise<MousePositionResponse> {
		const response = await getMousePosition({ client: await this.toolbox() });
		return response.data;
	}

	public async move(x: number, y: number): Promise<MousePositionResponse> {
		const response = await moveMouse({
			client: await this.toolbox(),
			body: { x, y },
		});
		return response.data;
	}

	public async click(
		x: number,
		y: number,
		button = DEFAULT_MOUSE_BUTTON,
		double = false
	): Promise<MouseClickResponse> {
		const response = await click({
			client: await this.toolbox(),
			body: { x, y, button, double },
		});
		return response.data;
	}

	public async drag(
		startX: number,
		startY: number,
		endX: number,
		endY: number,
		button = DEFAULT_MOUSE_BUTTON
	): Promise<MouseDragResponse> {
		const response = await drag({
			client: await this.toolbox(),
			body: { startX, startY, endX, endY, button },
		});
		return response.data;
	}

	public async scroll(
		x: number,
		y: number,
		direction: MouseScrollRequest['direction'],
		amount = 1
	): Promise<boolean> {
		const response = await scroll({
			client: await this.toolbox(),
			body: { x, y, direction, amount },
		});
		return response.data.success ?? false;
	}
}
