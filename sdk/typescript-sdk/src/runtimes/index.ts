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

export interface RuntimeConfig {
	defaultEntrypoint: string;
	runCommand(entrypoint: string): string;
	buildAndRunCommand?(entrypoint: string): string;
	installCommand?(packages: string[]): string;
}

export const runtimes: Record<string, RuntimeConfig> = {
	typescript: {
		defaultEntrypoint: 'index.ts',
		runCommand: (ep) => `npx ts-node ${ep}`,
		buildAndRunCommand: (ep) => {
			const out = ep.replace(/\.ts$/, '.js');
			return `npx tsc ${ep} && node ${out}`;
		},
		installCommand: (pkgs) => `npm install ${pkgs.join(' ')}`,
	},
	javascript: {
		defaultEntrypoint: 'index.js',
		runCommand: (ep) => `node ${ep}`,
		installCommand: (pkgs) => `npm install ${pkgs.join(' ')}`,
	},
	bun: {
		defaultEntrypoint: 'index.ts',
		runCommand: (ep) => `bun run ${ep}`,
		buildAndRunCommand: (ep) => {
			const out = ep.replace(/\.ts$/, '');
			return `bun build ${ep} --outfile ${out} && ./${out}`;
		},
		installCommand: (pkgs) => `bun add ${pkgs.join(' ')}`,
	},
	go: {
		defaultEntrypoint: 'main.go',
		runCommand: (ep) => `go run ${ep}`,
		buildAndRunCommand: (ep) => {
			const out = ep.replace(/\.go$/, '');
			const bin = out.startsWith('/') ? out : `./${out}`;
			return `go build -o ${bin} ${ep} && ${bin}`;
		},
		installCommand: (pkgs) => `go get ${pkgs.join(' ')}`,
	},
	php: {
		defaultEntrypoint: 'index.php',
		runCommand: (ep) => `php ${ep}`,
		installCommand: (pkgs) => `composer require ${pkgs.join(' ')}`,
	},
	ruby: {
		defaultEntrypoint: 'index.rb',
		runCommand: (ep) => `ruby ${ep}`,
		installCommand: (pkgs) => `gem install ${pkgs.join(' ')}`,
	},
	lua: {
		defaultEntrypoint: 'index.lua',
		runCommand: (ep) => `lua ${ep}`,
		installCommand: (pkgs) => `luarocks install ${pkgs.join(' ')}`,
	},
	python: {
		defaultEntrypoint: 'index.py',
		runCommand: (ep) => `python3 ${ep}`,
		installCommand: (pkgs) => `pip install ${pkgs.join(' ')}`,
	},
	c: {
		defaultEntrypoint: 'main.c',
		runCommand: (ep) => {
			const out = ep.replace(/\.c$/, '');
			const bin = out.startsWith('/') ? out : `./${out}`;
			return `gcc ${ep} -o ${bin} && ${bin}`;
		},
	},
};
