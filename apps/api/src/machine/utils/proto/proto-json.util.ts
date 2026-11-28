/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import {
	type DescMessage,
	type JsonObject,
	type MessageShape,
	toJson,
} from '@bufbuild/protobuf';
import { canonicalJson } from '../../../common/utils/canonical-json.util';

const DIGEST_ALGORITHM = 'sha256';
const DIGEST_ENCODING = 'hex';

export function protoJsonObject<Desc extends DescMessage>(
	schema: Desc,
	message: MessageShape<Desc>
): JsonObject {
	const json = toJson(schema, message);
	if (typeof json !== 'object' || json === null || Array.isArray(json)) {
		throw new Error(`${schema.typeName} did not encode to a JSON object`);
	}
	return json;
}

export function protoJsonDigest<Desc extends DescMessage>(
	schema: Desc,
	message: MessageShape<Desc>
): string {
	return createHash(DIGEST_ALGORITHM)
		.update(canonicalJson(toJson(schema, message)))
		.digest(DIGEST_ENCODING);
}
