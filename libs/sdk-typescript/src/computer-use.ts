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
	type ComputerUseStartResponse,
	type ComputerUseStatusResponse,
	type ComputerUseStopResponse,
	getComputerUseStatus,
	getProcessErrors,
	getProcessLogs,
	getProcessStatus,
	type ProcessErrorsResponse,
	type ProcessLogsResponse,
	type ProcessRestartResponse,
	type ProcessStatusResponse,
	restartProcess,
	startComputerUse,
	stopComputerUse,
} from '@snapflow/toolbox-api-client';
import { Accessibility } from './computer-use/accessibility.js';
import { Display } from './computer-use/display.js';
import { Keyboard } from './computer-use/keyboard.js';
import { Mouse } from './computer-use/mouse.js';
import { Screenshot } from './computer-use/screenshot.js';
import type {
	DesktopLink,
	DesktopLinkOptions,
	DesktopLinkProvider,
} from './desktop-link.js';
import type { ToolboxClientProvider } from './edge-toolbox-session.js';

export class ComputerUse {
	public readonly mouse: Mouse;
	public readonly keyboard: Keyboard;
	public readonly screenshot: Screenshot;
	public readonly display: Display;
	public readonly accessibility: Accessibility;

	constructor(
		private readonly toolbox: ToolboxClientProvider,
		private readonly desktopLinks: DesktopLinkProvider
	) {
		this.mouse = new Mouse(toolbox);
		this.keyboard = new Keyboard(toolbox);
		this.screenshot = new Screenshot(toolbox);
		this.display = new Display(toolbox);
		this.accessibility = new Accessibility(toolbox);
	}

	public async start(): Promise<ComputerUseStartResponse> {
		const response = await startComputerUse({ client: await this.toolbox() });
		return response.data;
	}

	public async getDesktopLink(
		options?: DesktopLinkOptions
	): Promise<DesktopLink> {
		return this.desktopLinks(options);
	}

	public async stop(): Promise<ComputerUseStopResponse> {
		const response = await stopComputerUse({ client: await this.toolbox() });
		return response.data;
	}

	public async getStatus(): Promise<ComputerUseStatusResponse> {
		const response = await getComputerUseStatus({
			client: await this.toolbox(),
		});
		return response.data;
	}

	public async getProcessStatus(
		processName: string
	): Promise<ProcessStatusResponse> {
		const response = await getProcessStatus({
			client: await this.toolbox(),
			path: { processName },
		});
		return response.data;
	}

	public async restartProcess(
		processName: string
	): Promise<ProcessRestartResponse> {
		const response = await restartProcess({
			client: await this.toolbox(),
			path: { processName },
		});
		return response.data;
	}

	public async getProcessLogs(
		processName: string
	): Promise<ProcessLogsResponse> {
		const response = await getProcessLogs({
			client: await this.toolbox(),
			path: { processName },
		});
		return response.data;
	}

	public async getProcessErrors(
		processName: string
	): Promise<ProcessErrorsResponse> {
		const response = await getProcessErrors({
			client: await this.toolbox(),
			path: { processName },
		});
		return response.data;
	}
}
