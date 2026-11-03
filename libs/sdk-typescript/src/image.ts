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

import * as pathe from 'pathe';
import { quote } from 'shell-quote';
import { SnapflowValidationError } from './errors/snapflow-error.js';
import {
	collectCopyContexts,
	debianSlimDockerfile,
	formatRunCommand,
	isStringList,
	toExecForm,
} from './image/dockerfile.js';
import { resolveLocalPath } from './image/local-path.js';
import {
	flattenStringArgs,
	formatPipInstallArgs,
	readPyprojectDependencies,
	resolvePythonVersion,
	type SupportedPythonSeries,
} from './image/python.js';
import type {
	Context,
	PipInstallOptions,
	PyprojectOptions,
} from './image.types.js';
import { nodeBuiltin } from './utils/import.js';

export class Image {
	private _dockerfile = '';
	private _contextList: Context[] = [];

	private constructor() {}

	get dockerfile(): string {
		return this._dockerfile;
	}

	get contextList(): Context[] {
		return this._contextList;
	}

	pipInstall(packages: string | string[], options?: PipInstallOptions): Image {
		const pkgs = flattenStringArgs('pipInstall', 'packages', packages);
		if (!pkgs.length) return this;

		const extraArgs = formatPipInstallArgs(options);
		this._dockerfile += `RUN python -m pip install ${quote(pkgs.sort())}${extraArgs}\n`;

		return this;
	}

	pipInstallFromRequirements(
		requirementsTxt: string,
		options?: PipInstallOptions
	): Image {
		const expandedPath = resolveLocalPath({
			path: requirementsTxt,
			kind: 'file',
			missingLabel: 'Requirements file',
			wrongKindLabel: 'Requirements path',
			importErrorPrefix: '"pipInstallFromRequirements" is not supported: ',
		});

		const extraArgs = formatPipInstallArgs(options);

		this.addContext(expandedPath);
		this._dockerfile += `COPY ${expandedPath} /.requirements.txt\n`;
		this._dockerfile += `RUN python -m pip install -r /.requirements.txt${extraArgs}\n`;

		return this;
	}

	pipInstallFromPyproject(
		pyprojectToml: string,
		options?: PyprojectOptions
	): Image {
		const importErrorPrefix = '"pipInstallFromPyproject" is not supported: ';
		const expandedPath = resolveLocalPath({
			path: pyprojectToml,
			kind: 'file',
			missingLabel: 'pyproject.toml file',
			wrongKindLabel: 'pyproject.toml path',
			importErrorPrefix,
		});

		const dependencies = readPyprojectDependencies(
			expandedPath,
			pyprojectToml,
			options,
			importErrorPrefix
		);
		return this.pipInstall(dependencies, options);
	}

	addLocalFile(localPath: string, remotePath: string): Image {
		const expandedPath = resolveLocalPath({
			path: localPath,
			kind: 'file',
			missingLabel: 'Local file',
			wrongKindLabel: 'Local path',
			importErrorPrefix: '"addLocalFile" is not supported: ',
		});
		const destination = remotePath.endsWith('/')
			? remotePath + pathe.basename(localPath)
			: remotePath;

		this.addContext(expandedPath);
		this._dockerfile += `COPY ${expandedPath} ${destination}\n`;

		return this;
	}

	addLocalDir(localPath: string, remotePath: string): Image {
		const expandedPath = resolveLocalPath({
			path: localPath,
			kind: 'directory',
			missingLabel: 'Local directory',
			wrongKindLabel: 'Local path',
			importErrorPrefix: '"addLocalDir" is not supported: ',
		});

		this.addContext(expandedPath);
		this._dockerfile += `COPY ${expandedPath} ${remotePath}\n`;

		return this;
	}

	runCommands(...commands: (string | string[])[]): Image {
		for (const command of commands) {
			this._dockerfile += `RUN ${formatRunCommand(command)}\n`;
		}

		return this;
	}

	env(envVars: Record<string, string>): Image {
		const nonStringKeys = Object.entries(envVars)
			.filter(([, value]) => typeof value !== 'string')
			.map(([key]) => key);

		if (nonStringKeys.length) {
			throw new SnapflowValidationError(
				`Image ENV variables must be strings. Invalid keys: ${nonStringKeys}`
			);
		}

		for (const [key, val] of Object.entries(envVars)) {
			this._dockerfile += `ENV ${key}=${quote([val])}\n`;
		}

		return this;
	}

	workdir(dirPath: string): Image {
		this._dockerfile += `WORKDIR ${quote([dirPath])}\n`;
		return this;
	}

	entrypoint(entrypointCommands: string[]): Image {
		if (!isStringList(entrypointCommands)) {
			throw new SnapflowValidationError(
				'entrypoint_commands must be a list of strings'
			);
		}

		this._dockerfile += `ENTRYPOINT [${toExecForm(entrypointCommands)}]\n`;
		return this;
	}

	cmd(cmd: string[]): Image {
		if (!isStringList(cmd)) {
			throw new SnapflowValidationError('Image CMD must be a list of strings');
		}

		this._dockerfile += `CMD [${toExecForm(cmd)}]\n`;
		return this;
	}

	dockerfileCommands(dockerfileCommands: string[], contextDir?: string): Image {
		if (contextDir) {
			resolveLocalPath({
				path: contextDir,
				kind: 'directory',
				missingLabel: 'Context directory',
				wrongKindLabel: 'Context path',
				importErrorPrefix: '"dockerfileCommands" is not supported: ',
			});
		}

		const commands = dockerfileCommands.join('\n');
		this._contextList.push(...collectCopyContexts(commands, contextDir || ''));
		this._dockerfile += `${commands}\n`;
		return this;
	}

	static fromDockerfile(path: string): Image {
		const importErrorPrefix = '"fromDockerfile" is not supported: ';
		const expandedPath = pathe.resolve(
			resolveLocalPath({
				path,
				kind: 'file',
				missingLabel: 'Dockerfile',
				wrongKindLabel: 'Dockerfile path',
				importErrorPrefix,
			})
		);

		const fs = nodeBuiltin('node:fs', importErrorPrefix);
		const dockerfileContent = fs.readFileSync(expandedPath, 'utf-8');
		const img = new Image();
		img._dockerfile = dockerfileContent;

		const pathPrefix = pathe.dirname(expandedPath) + pathe.sep;
		img._contextList.push(
			...collectCopyContexts(dockerfileContent, pathPrefix)
		);

		return img;
	}

	static base(image: string): Image {
		const img = new Image();
		img._dockerfile = `FROM ${image}\n`;
		return img;
	}

	static debianSlim(pythonVersion?: SupportedPythonSeries): Image {
		const img = new Image();
		img._dockerfile = debianSlimDockerfile(resolvePythonVersion(pythonVersion));
		return img;
	}

	private addContext(expandedPath: string): void {
		this._contextList.push({
			sourcePath: expandedPath,
			archivePath: expandedPath,
		});
	}
}
