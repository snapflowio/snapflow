// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/useragent"
	"github.com/snapflowio/edge/internal/httptransport"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	maximumAPIResponseBytes        = 64 << 20
	conditionalControlReadWait     = 25 * time.Second
	conditionalReadRequestOverhead = 5 * time.Second
	apiRequestTimeout              = conditionalControlReadWait + conditionalReadRequestOverhead
	userAgentProduct               = "snapflow-edge"
)

type Config struct {
	APIURL           string
	EnrollmentSecret string
}

func NewAPIClient(apiURL string) (*apiclient.ClientWithResponses, error) {
	if strings.TrimSpace(apiURL) == "" {
		return nil, errors.New("edge API URL is required")
	}
	responseTransport, err := httptransport.NewBoundedResponseTransport(
		http.DefaultTransport,
		maximumAPIResponseBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("configure Snapflow API response limit: %w", err)
	}
	return apiclient.NewClientWithResponses(
		strings.TrimRight(apiURL, "/"),
		apiclient.WithHTTPClient(&http.Client{
			Transport: responseTransport,
			Timeout:   apiRequestTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}),
		apiclient.WithRequestEditorFn(useragent.RequestEditor(userAgentProduct)),
	)
}
