// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

func (c Config) Validate() error {
	storage := c.Registry.Storage
	if storage.S3Configured() && (storage.S3Region == "" || storage.S3Bucket == "") {
		return ErrS3LocationRequired
	}
	if c.Registry.TLS.Enabled() && c.Registry.TLS.Key == "" {
		return ErrTLSKeyRequired
	}
	if c.Registry.Auth.JWKSURL == "" {
		return ErrAuthJWKSURLRequired
	}
	if c.Registry.DrainTimeout <= 0 {
		return ErrDrainTimeoutInvalid
	}
	return nil
}
