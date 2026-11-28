// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import "errors"

var (
	ErrOptionRequired    = errors.New("access controller option is required")
	ErrJWKSURLRequired   = errors.New("registry token key set URL is required")
	ErrAccessDenied      = errors.New("registry token does not grant access")
	ErrInvalidToken      = errors.New("invalid registry token")
	ErrSubjectRequired   = errors.New("registry token has no subject")
	ErrTokenIDRequired   = errors.New("registry token has no id")
	ErrSubjectDenied     = errors.New("registry token subject is denied")
	ErrUnexpectedUser    = errors.New("registry credentials must use the token username")
	ErrCredentialMissing = errors.New("registry request carries no credentials")
)
