// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import "errors"

var (
	ErrS3LocationRequired = errors.New(
		"s3 storage requires " + S3RegionEnvironment + " and " + S3BucketEnvironment,
	)
	ErrTLSKeyRequired = errors.New(
		TLSKeyEnvironment + " is required when " + TLSCertificateEnvironment + " is set",
	)
	ErrAuthJWKSURLRequired = errors.New(AuthJWKSURLEnvironment + " is required")
	ErrDrainTimeoutInvalid = errors.New(DrainTimeoutEnvironment + " must be a positive duration")
	ErrAlreadyStarted      = errors.New("snapshot manager server was already started")
)
