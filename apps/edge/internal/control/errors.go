// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"errors"
	"net/http"

	"github.com/snapflowio/common-go/pkg/apierror"
)

func IsRetryable(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) {
		return false
	}
	if isAuthenticationFailure(err) {
		return true
	}
	var apiErr *apierror.Error
	if errors.As(err, &apiErr) {
		return apiErr.Retryable()
	}
	return true
}

func isAuthenticationFailure(err error) bool {
	return apierror.HasStatus(err, http.StatusUnauthorized)
}
