// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package computeruse

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
)

func httpReadyProbe(port string, currentCredential func() desktopCredential) func() error {
	address := net.JoinHostPort(desktopLoopbackInterface, port)
	url := "http://" + address + "/"
	client := &http.Client{
		Timeout:   computerProbeDialTimeout,
		Transport: &http.Transport{Proxy: nil, DisableKeepAlives: true},
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return func() error {
		ctx, cancel := context.WithTimeout(context.Background(), computerProbeDialTimeout)
		defer cancel()
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return fmt.Errorf("create readiness request for %s: %w", address, err)
		}
		credential := currentCredential()
		request.SetBasicAuth(credential.user, credential.password)
		response, err := client.Do(request)
		if err != nil {
			return fmt.Errorf("HTTP listener %s is not ready: %w", address, err)
		}
		closeErr := response.Body.Close()
		if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusBadRequest {
			return errors.Join(
				fmt.Errorf("HTTP listener %s returned status %d", address, response.StatusCode),
				closeErr,
			)
		}
		if closeErr != nil {
			return fmt.Errorf("close readiness response from %s: %w", address, closeErr)
		}
		return nil
	}
}
