/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const HASH_PLACEHOLDER = '__BOOTSTRAP_SCRIPT_HASH__';
const INLINE_SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi;
const EXPECTED_INLINE_SCRIPTS = 1;

const [fallbackPage, caddyfileTemplate, output] = process.argv.slice(2);
if (!(fallbackPage && caddyfileTemplate && output)) {
	throw new Error(
		'Usage: render-caddyfile.ts <fallback.html> <Caddyfile> <output>'
	);
}

const scripts = [...readFileSync(fallbackPage, 'utf8').matchAll(INLINE_SCRIPT)];
const [script] = scripts;
if (scripts.length !== EXPECTED_INLINE_SCRIPTS || !script?.[1]) {
	throw new Error(
		`Expected exactly one inline script in ${fallbackPage}, found ${scripts.length}.`
	);
}

const hash = createHash('sha256').update(script[1]).digest('base64');
const template = readFileSync(caddyfileTemplate, 'utf8');
if (!template.includes(HASH_PLACEHOLDER)) {
	throw new Error(
		`${caddyfileTemplate} has no ${HASH_PLACEHOLDER} placeholder.`
	);
}

writeFileSync(
	output,
	template.replaceAll(HASH_PLACEHOLDER, `'sha256-${hash}'`)
);
