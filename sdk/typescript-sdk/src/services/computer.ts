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

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
	ComputerUseApi,
	DisplayInfoResponse,
	PositionResponse,
	ScreenshotResponse,
	ScrollResponse,
	WindowsResponse,
} from '@snapflow/toolbox-client';

export interface ScreenshotRegion {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface ScreenshotOptions {
	readonly showCursor?: boolean;
	readonly format?: string;
	readonly quality?: number;
	readonly scale?: number;
}

export class Mouse {
	constructor(private readonly apiClient: ComputerUseApi) {}

	public async getPosition(): Promise<PositionResponse> {
		const response = await this.apiClient.getMousePosition();
		return response.data;
	}

	public async move(x: number, y: number): Promise<PositionResponse> {
		const response = await this.apiClient.moveMouse({ x, y });
		return response.data;
	}

	public async click(
		x: number,
		y: number,
		button: 'left' | 'right' | 'middle' = 'left',
		double = false
	): Promise<PositionResponse> {
		const response = await this.apiClient.clickMouse({ x, y, button, double });
		return response.data;
	}

	public async drag(
		startX: number,
		startY: number,
		endX: number,
		endY: number,
		button: 'left' | 'right' | 'middle' = 'left'
	): Promise<PositionResponse> {
		const response = await this.apiClient.dragMouse({
			startX,
			startY,
			endX,
			endY,
			button,
		});
		return response.data;
	}

	public async scroll(
		x: number,
		y: number,
		direction: 'up' | 'down',
		amount = 1
	): Promise<ScrollResponse> {
		const response = await this.apiClient.scrollMouse({
			x,
			y,
			direction,
			amount,
		});
		return response.data;
	}
}

export class Keyboard {
	constructor(private readonly apiClient: ComputerUseApi) {}

	public async type(text: string, delay?: number): Promise<void> {
		await this.apiClient.typeText({ text, delay });
	}

	public async press(key: string, modifiers: string[] = []): Promise<void> {
		await this.apiClient.pressKey({ key, modifiers });
	}

	public async hotkey(keys: string): Promise<void> {
		await this.apiClient.pressHotkey({ keys });
	}
}

export class Screenshot {
	constructor(private readonly apiClient: ComputerUseApi) {}

	public async takeFullScreen(showCursor = false): Promise<ScreenshotResponse> {
		const response = await this.apiClient.getScreenshot(
			showCursor ? 'true' : undefined
		);
		return response.data;
	}

	public async takeRegion(
		region: ScreenshotRegion,
		showCursor = false
	): Promise<ScreenshotResponse> {
		const response = await this.apiClient.getRegionScreenshot(
			region.x,
			region.y,
			region.width,
			region.height,
			showCursor ? 'true' : undefined
		);
		return response.data;
	}

	public async takeCompressed(
		options: ScreenshotOptions = {}
	): Promise<ScreenshotResponse> {
		const response = await this.apiClient.getCompressedScreenshot(
			options.format,
			options.quality,
			options.scale,
			options.showCursor ? 'true' : undefined
		);
		return response.data;
	}

	public async takeCompressedRegion(
		region: ScreenshotRegion,
		options: ScreenshotOptions = {}
	): Promise<ScreenshotResponse> {
		const response = await this.apiClient.getCompressedRegionScreenshot(
			region.x,
			region.y,
			region.width,
			region.height,
			options.format,
			options.quality,
			options.scale,
			options.showCursor ? 'true' : undefined
		);
		return response.data;
	}
}

export class Display {
	constructor(private readonly apiClient: ComputerUseApi) {}

	public async getInfo(): Promise<DisplayInfoResponse> {
		const response = await this.apiClient.getDisplayInfo();
		return response.data;
	}

	public async getWindows(): Promise<WindowsResponse> {
		const response = await this.apiClient.getWindows();
		return response.data;
	}
}

export class ComputerUse {
	public readonly mouse: Mouse;
	public readonly keyboard: Keyboard;
	public readonly screenshot: Screenshot;
	public readonly display: Display;

	constructor(private readonly apiClient: ComputerUseApi) {
		this.mouse = new Mouse(apiClient);
		this.keyboard = new Keyboard(apiClient);
		this.screenshot = new Screenshot(apiClient);
		this.display = new Display(apiClient);
	}

	public async start(): Promise<void> {
		await this.apiClient.startComputer();
	}

	public async stop(): Promise<void> {
		await this.apiClient.stopComputer();
	}

	public async getStatus(): Promise<void> {
		await this.apiClient.getComputerStatus();
	}

	public async getProcessStatus(processName: string): Promise<void> {
		await this.apiClient.getSingleProcessStatus(processName);
	}

	public async restartProcess(processName: string): Promise<void> {
		await this.apiClient.restartProcess(processName);
	}

	public async getProcessLogs(processName: string): Promise<void> {
		await this.apiClient.getProcessLogs(processName);
	}

	public async getProcessErrors(processName: string): Promise<void> {
		await this.apiClient.getProcessErrors(processName);
	}
}
