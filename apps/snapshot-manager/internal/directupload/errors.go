// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import "errors"

var (
	errUploadNotFound    = errors.New("upload not found")
	errMalformedRequest  = errors.New("malformed request body")
	errInvalidRepository = errors.New("invalid repository name")
	errInvalidDigest     = errors.New("digest must be sha256:<64 lowercase hex>")
	errBlobTooSmall      = errors.New("size must be at least 1 byte")
	errBlobTooLarge      = errors.New("size exceeds the maximum blob size")
	errContentMismatch   = errors.New("uploaded content does not match the claimed blob")
	errDataMissing       = errors.New("upload data has not been written yet")
	errAuthentication    = errors.New("registry authentication required")
	errAccessDenied      = errors.New("registry token does not grant push on this repository")
	errRateLimited       = errors.New("rate limit exceeded")
	errTooManyUploads    = errors.New("too many unfinished uploads")
	errInternal          = errors.New("internal error")
)
