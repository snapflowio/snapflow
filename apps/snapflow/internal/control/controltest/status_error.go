// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package controltest

import "github.com/snapflowio/common-go/pkg/apierror"

const statusErrorOperation = "test operation"

type statusResult int

func (result statusResult) StatusCode() int {
	return int(result)
}

func (statusResult) GetBody() []byte {
	return nil
}

func StatusError(statusCode int) error {
	return apierror.CheckResponse(statusErrorOperation, statusResult(statusCode), nil)
}
