// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/common-go/pkg/useragent"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	CLIDeviceClientID = "snapflow"

	deviceCodePath           = "/auth/device/code"
	deviceTokenPath          = "/auth/device/token"
	signOutPath              = "/auth/sign-out"
	deviceCodeGrantType      = "urn:ietf:params:oauth:grant-type:device_code"
	bearerTokenType          = "Bearer"
	contentTypeHeader        = "Content-Type"
	userAgentHeader          = "User-Agent"
	retryAfterHeader         = "Retry-After"
	jsonContentType          = "application/json"
	deviceHTTPTimeout        = 30 * time.Second
	minimumDevicePollDelay   = time.Second
	maximumDevicePollDelay   = time.Minute
	slowDownIncrement        = 5 * time.Second
	maximumAuthResponseBytes = 64 << 10

	oauthAuthorizationPending = "authorization_pending"
	oauthSlowDown             = "slow_down"
	oauthExpiredToken         = "expired_token"
	oauthAccessDenied         = "access_denied"
	oauthInvalidGrant         = "invalid_grant"

	requestCodeOperation = "request a machine approval code"
	pollTokenOperation   = "poll machine approval"
	signOutOperation     = "sign out the machine approval session"
)

var (
	ErrDeviceCodeExpired  = errors.New("the approval code expired before it was approved")
	ErrDeviceDenied       = errors.New("the approval request was denied in the dashboard")
	ErrDeviceGrantInvalid = errors.New("the approval code is no longer valid")
)

type DeviceAuthorization struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type deviceCodeRequest struct {
	ClientID string `json:"client_id"`
}

type deviceTokenRequest struct {
	GrantType  string `json:"grant_type"`
	DeviceCode string `json:"device_code"`
	ClientID   string `json:"client_id"`
}

type deviceToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
}

type oauthError struct {
	Code        string `json:"error"`
	Description string `json:"error_description"`
}

func (failure oauthError) Error() string {
	if failure.Description == "" {
		return failure.Code
	}
	return failure.Code + ": " + failure.Description
}

type pendingPoll struct {
	slowDown   bool
	retryAfter time.Duration
	cause      error
}

func (pending *pendingPoll) Error() string { return pending.cause.Error() }

func (pending *pendingPoll) Unwrap() error { return pending.cause }

type authResponse struct {
	statusCode int
	retryAfter time.Duration
	body       []byte
}

type deviceClient struct {
	baseURL string
	http    *http.Client
	wait    func(context.Context, time.Duration) error
}

func newDeviceClient(serverURL string) (*deviceClient, error) {
	baseURL, err := normalizeServerURL(serverURL)
	if err != nil {
		return nil, err
	}
	return &deviceClient{baseURL: baseURL, http: &http.Client{Timeout: deviceHTTPTimeout}, wait: waitFor}, nil
}

func (client *deviceClient) requestCode(ctx context.Context) (DeviceAuthorization, error) {
	response, err := client.post(ctx, deviceCodePath, "", deviceCodeRequest{ClientID: CLIDeviceClientID})
	if err != nil {
		return DeviceAuthorization{}, fmt.Errorf("request a machine approval code: %w", err)
	}
	if err := response.check(requestCodeOperation); err != nil {
		return DeviceAuthorization{}, err
	}
	var authorization DeviceAuthorization
	if err := json.Unmarshal(response.body, &authorization); err != nil {
		return DeviceAuthorization{}, fmt.Errorf("decode machine approval code: %w", err)
	}
	if authorization.DeviceCode == "" || authorization.UserCode == "" ||
		authorization.VerificationURIComplete == "" || authorization.ExpiresIn <= 0 {
		return DeviceAuthorization{}, errors.New("the API returned an incomplete machine approval code")
	}
	return authorization, nil
}

func (client *deviceClient) awaitToken(ctx context.Context, authorization DeviceAuthorization) (string, error) {
	interval := max(minimumDevicePollDelay, seconds(authorization.Interval))
	delay := interval
	deadline := time.Now().Add(seconds(authorization.ExpiresIn))
	for time.Now().Before(deadline) {
		if err := client.wait(ctx, delay); err != nil {
			return "", err
		}
		token, err := client.pollToken(ctx, authorization.DeviceCode)
		var pending *pendingPoll
		if !errors.As(err, &pending) {
			return token, err
		}
		if pending.slowDown {
			interval = min(maximumDevicePollDelay, interval+slowDownIncrement)
		}
		delay = min(maximumDevicePollDelay, max(interval, pending.retryAfter))
	}
	return "", ErrDeviceCodeExpired
}

func (client *deviceClient) pollToken(ctx context.Context, deviceCode string) (string, error) {
	response, err := client.post(ctx, deviceTokenPath, "", deviceTokenRequest{
		GrantType: deviceCodeGrantType, DeviceCode: deviceCode, ClientID: CLIDeviceClientID,
	})
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", &pendingPoll{cause: err}
	}
	if response.statusCode == http.StatusOK {
		return response.accessToken()
	}
	if apierror.RetryableStatus(response.statusCode) {
		return "", &pendingPoll{retryAfter: response.retryAfter, cause: response.check(pollTokenOperation)}
	}
	return "", response.pollOutcome()
}

func (client *deviceClient) signOut(ctx context.Context, accessToken string) error {
	response, err := client.post(ctx, signOutPath, accessToken, struct{}{})
	if err != nil {
		return fmt.Errorf("sign out the machine approval session: %w", err)
	}
	if err := response.check(signOutOperation); err != nil {
		return err
	}
	return nil
}

func (client *deviceClient) post(ctx context.Context, path, accessToken string, payload any) (authResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return authResponse{}, fmt.Errorf("encode request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return authResponse{}, fmt.Errorf("build request: %w", err)
	}
	request.Header.Set(contentTypeHeader, jsonContentType)
	return client.do(request, accessToken)
}

func (client *deviceClient) get(ctx context.Context, path, accessToken string) (authResponse, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, client.baseURL+path, http.NoBody)
	if err != nil {
		return authResponse{}, fmt.Errorf("build request: %w", err)
	}
	return client.do(request, accessToken)
}

func (client *deviceClient) do(request *http.Request, accessToken string) (authResponse, error) {
	request.Header.Set(userAgentHeader, useragent.Value(userAgentProduct))
	if accessToken != "" {
		request.Header.Set(authorizationHeader, bearerTokenType+" "+accessToken)
	}
	response, err := client.http.Do(request)
	if err != nil {
		return authResponse{}, err
	}
	responseBody, readErr := io.ReadAll(io.LimitReader(response.Body, maximumAuthResponseBytes))
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		return authResponse{}, fmt.Errorf("read response: %w", err)
	}
	return authResponse{
		statusCode: response.StatusCode,
		retryAfter: apierror.ParseRetryAfter(response.Header.Get(retryAfterHeader), time.Now()),
		body:       responseBody,
	}, nil
}

func (response authResponse) accessToken() (string, error) {
	var token deviceToken
	if err := json.Unmarshal(response.body, &token); err != nil {
		return "", fmt.Errorf("decode machine approval token: %w", err)
	}
	if token.AccessToken == "" || !strings.EqualFold(token.TokenType, bearerTokenType) {
		return "", errors.New("the API returned an unusable machine approval token")
	}
	return token.AccessToken, nil
}

func (response authResponse) pollOutcome() error {
	var failure oauthError
	if err := json.Unmarshal(response.body, &failure); err != nil || failure.Code == "" {
		return response.check(pollTokenOperation)
	}
	switch failure.Code {
	case oauthAuthorizationPending:
		return &pendingPoll{retryAfter: response.retryAfter, cause: failure}
	case oauthSlowDown:
		return &pendingPoll{slowDown: true, retryAfter: response.retryAfter, cause: failure}
	case oauthExpiredToken:
		return ErrDeviceCodeExpired
	case oauthAccessDenied:
		return ErrDeviceDenied
	case oauthInvalidGrant:
		return fmt.Errorf("%w: %w", ErrDeviceGrantInvalid, failure)
	default:
		return fmt.Errorf("poll machine approval: %w", failure)
	}
}

func (response authResponse) StatusCode() int { return response.statusCode }

func (response authResponse) GetBody() []byte { return response.body }

func (response authResponse) check(operation string) error {
	err := apierror.CheckResponse(operation, response, nil)
	if err == nil {
		return nil
	}
	var failure oauthError
	if json.Unmarshal(response.body, &failure) == nil && failure.Code != "" {
		return fmt.Errorf("%s failed with HTTP %d: %w", operation, response.statusCode, failure)
	}
	return err
}

func seconds(value int) time.Duration {
	return time.Duration(value) * time.Second
}

func waitFor(ctx context.Context, delay time.Duration) error {
	if !reconnect.Wait(ctx, delay) {
		return ctx.Err()
	}
	return nil
}
