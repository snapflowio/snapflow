// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package controltest

import (
	"errors"
	"net/http"

	"github.com/snapflowio/common-go/pkg/apierror"
)

const (
	failureOperation = "test operation"
	failureDetail    = "rejected"
)

func Failure(statusCode int) error {
	return &apierror.Error{
		Operation:  failureOperation,
		StatusCode: statusCode,
		Detail:     failureDetail,
		Cause:      errors.New(http.StatusText(statusCode)),
	}
}
