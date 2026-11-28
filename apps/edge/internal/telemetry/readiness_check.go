// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const (
	readinessCheckScheme  = "http"
	readinessCheckTimeout = 2 * time.Second
)

func CheckReadiness(ctx context.Context, listenAddress string) error {
	ctx, cancel := context.WithTimeout(ctx, readinessCheckTimeout)
	defer cancel()
	target := url.URL{Scheme: readinessCheckScheme, Host: listenAddress, Path: readinessPath}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return fmt.Errorf("build readiness request: %w", err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return fmt.Errorf("request edge readiness: %w", err)
	}
	var statusErr error
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		statusErr = fmt.Errorf("edge readiness %s returned %s", target.String(), response.Status)
	}
	if closeErr := response.Body.Close(); closeErr != nil {
		return errors.Join(statusErr, fmt.Errorf("close readiness response: %w", closeErr))
	}
	return statusErr
}
