// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package openbao

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/snapflowio/origin/internal/config"
)

const (
	loginPath           = "/v1/auth/kubernetes/login"
	signPath            = "/v1/pki/sign/snapflow-tunnel-origin"
	loginRole           = "snapflow-origin"
	tokenHeader         = "X-Vault-Token"
	proxyRequestHeader  = "X-Vault-Request"
	proxyRequestValue   = "true"
	certificateFormat   = "pem"
	requestTimeout      = 15 * time.Second
	maxResponseBytes    = 1 << 20
	maxErrorDetailBytes = 512
	jsonContentType     = "application/json"
)

type Client struct {
	address   string
	auth      config.OpenBaoAuth
	tokenFile string
	http      *http.Client
}

func New(settings config.Config) *Client {
	return &Client{
		address:   settings.OpenBaoAddress,
		auth:      settings.OpenBaoAuth,
		tokenFile: settings.OpenBaoTokenFile,
		http:      &http.Client{Timeout: requestTimeout},
	}
}

type loginResponse struct {
	Auth struct {
		ClientToken string `json:"client_token"`
	} `json:"auth"`
}

type signResponse struct {
	Data struct {
		Certificate string   `json:"certificate"`
		IssuingCA   string   `json:"issuing_ca"`
		CAChain     []string `json:"ca_chain"`
	} `json:"data"`
}

func (client *Client) Sign(ctx context.Context, csr, identityURI string, ttl time.Duration) (string, error) {
	token, err := client.token(ctx)
	if err != nil {
		return "", err
	}
	var signed signResponse
	if err := client.post(ctx, signPath, token, map[string]any{
		"csr":                  csr,
		"uri_sans":             identityURI,
		"exclude_cn_from_sans": true,
		"format":               certificateFormat,
		"ttl":                  ttl.String(),
	}, &signed); err != nil {
		return "", fmt.Errorf("sign origin tunnel certificate: %w", err)
	}
	if signed.Data.Certificate == "" {
		return "", errors.New("OpenBao returned no origin tunnel certificate")
	}
	chain := append([]string{signed.Data.Certificate}, signed.Data.CAChain...)
	if len(signed.Data.CAChain) == 0 && signed.Data.IssuingCA != "" {
		chain = append(chain, signed.Data.IssuingCA)
	}
	return strings.Join(chain, "\n"), nil
}

func (client *Client) token(ctx context.Context) (string, error) {
	if client.auth == config.OpenBaoAuthProxy {
		return "", nil
	}
	jwt, err := os.ReadFile(client.tokenFile)
	if err != nil {
		return "", fmt.Errorf("read the service account token: %w", err)
	}
	var login loginResponse
	if err := client.post(ctx, loginPath, "", map[string]string{
		"role": loginRole,
		"jwt":  strings.TrimSpace(string(jwt)),
	}, &login); err != nil {
		return "", fmt.Errorf("log in to OpenBao: %w", err)
	}
	if login.Auth.ClientToken == "" {
		return "", errors.New("OpenBao returned no client token")
	}
	return login.Auth.ClientToken, nil
}

func (client *Client) post(ctx context.Context, path, token string, body, destination any) (resultErr error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("encode request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.address+path, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	request.Header.Set("Content-Type", jsonContentType)
	request.Header.Set(proxyRequestHeader, proxyRequestValue)
	if token != "" {
		request.Header.Set(tokenHeader, token)
	}
	response, err := client.http.Do(request)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close response: %w", closeErr))
		}
	}()
	content, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("OpenBao answered %s: %s", response.Status, truncate(content))
	}
	if err := json.Unmarshal(content, destination); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func truncate(content []byte) string {
	if len(content) > maxErrorDetailBytes {
		content = content[:maxErrorDetailBytes]
	}
	return strings.TrimSpace(string(content))
}
