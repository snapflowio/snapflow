// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package canary

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/common-go/pkg/toolboxapi"
)

const (
	contentTypeHeader = "Content-Type"
	jsonMediaType     = "application/json"
)

type Session struct {
	runtime   Runtime
	sandboxID string
}

func (session *Session) Execute(ctx context.Context, request toolboxapi.ExecuteRequest) (result toolboxapi.ExecuteResponse, resultErr error) {
	target, err := session.runtime.GuestServiceTarget(ctx, session.sandboxID, guestspec.ToolboxService)
	if err != nil {
		return result, fmt.Errorf("resolve the canary toolbox: %w", err)
	}
	body, err := json.Marshal(request)
	if err != nil {
		return result, fmt.Errorf("encode the canary toolbox request: %w", err)
	}
	endpoint := target.URL.ResolveReference(&url.URL{Path: toolboxapi.ExecutePath})
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return result, fmt.Errorf("create the canary toolbox request: %w", err)
	}
	target.ApplyHeaders(httpRequest.Header)
	httpRequest.Header.Set(contentTypeHeader, jsonMediaType)
	response, err := (&http.Client{Transport: target.Transport}).Do(httpRequest)
	if err != nil {
		return result, fmt.Errorf("call the canary toolbox: %w", err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close the canary toolbox response: %w", closeErr))
		}
	}()
	if target.ObserveResponse != nil {
		if err := target.ObserveResponse(ctx, response.StatusCode); err != nil {
			return result, fmt.Errorf("record the canary toolbox response: %w", err)
		}
	}
	if response.StatusCode != http.StatusOK {
		return result, fmt.Errorf("the canary toolbox returned HTTP %d", response.StatusCode)
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return result, fmt.Errorf("decode the canary toolbox response: %w", err)
	}
	return result, nil
}
