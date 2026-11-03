// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package localapi

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/snapflow/internal/workload"
)

func recoverableErrorsMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx *echo.Context) error {
			err := next(ctx)
			if err == nil || !workload.IsRecoverable(err.Error()) {
				return err
			}

			response := map[string]any{
				"errorReason": err.Error() + " - you may attempt a recovery action",
				"recoverable": true,
			}
			body, marshalErr := json.Marshal(response)
			if marshalErr != nil {
				return fmt.Errorf("marshal recoverable error response: %w", marshalErr)
			}
			return common_errors.NewCustomError(http.StatusBadRequest, string(body), "BAD_REQUEST")
		}
	}
}
