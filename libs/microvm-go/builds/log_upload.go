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

package builds

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/snapflowio/microvm-go/internal/transferpolicy"
)

const (
	buildLogContentType       = "text/plain; charset=utf-8"
	maximumUploadResponseSize = 64 << 10
)

func uploadBuildLog(ctx context.Context, transfers transferpolicy.Policy, value string, content []byte) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	target, err := transfers.Parse(value)
	if err != nil {
		return fmt.Errorf("build log upload URL: %w", err)
	}
	client := &http.Client{
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return errors.New("build log upload redirects are not allowed")
		},
	}
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPut,
		target.String(),
		bytes.NewReader(content),
	)
	if err != nil {
		return fmt.Errorf("create build log upload request: %w", err)
	}
	request.Header.Set("Content-Type", buildLogContentType)
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("upload build log: %w", err)
	}
	_, readErr := io.Copy(
		io.Discard,
		io.LimitReader(response.Body, maximumUploadResponseSize),
	)
	closeErr := response.Body.Close()
	if readErr != nil {
		return errors.Join(
			fmt.Errorf("read build log upload response: %w", readErr),
			closeErr,
		)
	}
	if closeErr != nil {
		return fmt.Errorf("close build log upload response: %w", closeErr)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("build log upload returned %s", response.Status)
	}
	return nil
}
