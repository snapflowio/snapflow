/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ApiErrorBody,
	apiError,
} from '../../common/utils/error/api-error.util';
import { NetworkingErrorCode } from '../enums/networking-error-code.enum';

export const EXPOSURE_NOT_FOUND = apiError(
	NetworkingErrorCode.EXPOSURE_NOT_FOUND,
	'The exposure was not found. Check the exposure ID; it may have been deleted.'
);

export const EDGE_NOT_FOUND = apiError(
	NetworkingErrorCode.EDGE_NOT_FOUND,
	'The Edge was not found. Check the Edge ID; it may have been removed.'
);

export const ACCESS_GRANT_INVALID = apiError(
	NetworkingErrorCode.ACCESS_GRANT_INVALID,
	'The access link is invalid, expired or already used. Open the exposure again from Snapflow to get a new link.'
);

export const EDGE_SESSION_FENCED = apiError(
	NetworkingErrorCode.EDGE_SESSION_FENCED,
	'This Edge session was replaced by a newer one. Stop using it and open a new session.'
);

export const EDGE_SESSION_INVALID = apiError(
	NetworkingErrorCode.EDGE_SESSION_INVALID,
	'The Edge session is invalid or expired. Open a new Edge session.'
);

export const EDGE_NOT_ELIGIBLE = apiError(
	NetworkingErrorCode.EDGE_NOT_ELIGIBLE,
	'This Edge is not active and cannot open a session. Activate the Edge, then retry.'
);

export const MACHINE_TUNNEL_FENCED = apiError(
	NetworkingErrorCode.MACHINE_TUNNEL_FENCED,
	'This machine tunnel binding was replaced by a newer one. Refresh the tunnel plan and retry.'
);

export const TUNNEL_CERTIFICATE_UNAVAILABLE = apiError(
	NetworkingErrorCode.TUNNEL_CERTIFICATE_UNAVAILABLE,
	'A tunnel certificate cannot be issued right now. Retry in a few minutes.'
);

export function edgeReportRejected(reason: string): ApiErrorBody {
	return apiError(
		NetworkingErrorCode.EDGE_REPORT_INVALID,
		`${reason}. Fix the report and send it again.`
	);
}

export function exposureCutoverRejected(reason: string): ApiErrorBody {
	return apiError(
		NetworkingErrorCode.EXPOSURE_CUTOVER_STATE_INVALID,
		`${reason}. Reload the exposure and retry the cutover step that matches its current state.`
	);
}
