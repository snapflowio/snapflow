// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
)

const (
	deviceCodeAPI      = controltest.APIPrefix + "/auth/device/code"
	deviceTokenAPI     = controltest.APIPrefix + "/auth/device/token"
	signOutAPI         = controltest.APIPrefix + "/auth/sign-out"
	testDeviceCode     = "device-secret"
	testUserCode       = "XKHMR59E"
	testAccessToken    = "approval-session-token"
	testPollInterval   = 5
	testCodeLifetime   = 900
	testRetryAfter     = 20
	deviceGrantType    = "urn:ietf:params:oauth:grant-type:device_code"
	pollInterval       = testPollInterval * time.Second
	slowedPollInterval = pollInterval + 5*time.Second
)

type tokenReply struct {
	status     int
	body       any
	retryAfter string
}

func oauthFailure(code string) tokenReply {
	return tokenReply{status: http.StatusBadRequest, body: map[string]string{"error": code, "error_description": code}}
}

func approved() tokenReply {
	return tokenReply{status: http.StatusOK, body: map[string]any{
		"access_token": testAccessToken, "token_type": "Bearer", "expires_in": testCodeLifetime, "scope": "",
	}}
}

func testAuthorization() control.DeviceAuthorization {
	return control.DeviceAuthorization{
		DeviceCode: testDeviceCode, UserCode: testUserCode, VerificationURIComplete: "http://dashboard/device?user_code=" + testUserCode,
		ExpiresIn: testCodeLifetime, Interval: testPollInterval,
	}
}

type tokenEndpoint struct {
	t       testing.TB
	mu      sync.Mutex
	replies []tokenReply
	polls   int
}

func (endpoint *tokenEndpoint) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	var body map[string]string
	controltest.DecodeJSON(endpoint.t, request, &body)
	if body["grant_type"] != deviceGrantType || body["device_code"] != testDeviceCode ||
		body["client_id"] != control.CLIDeviceClientID {
		endpoint.t.Errorf("device token request = %v", body)
	}
	endpoint.mu.Lock()
	reply := endpoint.replies[min(endpoint.polls, len(endpoint.replies)-1)]
	endpoint.polls++
	endpoint.mu.Unlock()
	if reply.retryAfter != "" {
		writer.Header().Set("Retry-After", reply.retryAfter)
	}
	controltest.WriteJSON(endpoint.t, writer, reply.status, reply.body)
}

type recordedWaits struct {
	delays []time.Duration
}

func (waits *recordedWaits) wait(ctx context.Context, delay time.Duration) error {
	waits.delays = append(waits.delays, delay)
	return ctx.Err()
}

func TestAwaitDeviceTokenStateMachine(t *testing.T) {
	tests := []struct {
		name    string
		replies []tokenReply
		want    error
		delays  []time.Duration
	}{
		{
			name:    "pending until approved",
			replies: []tokenReply{oauthFailure("authorization_pending"), oauthFailure("authorization_pending"), approved()},
			delays:  []time.Duration{pollInterval, pollInterval, pollInterval},
		},
		{
			name:    "slow down adds five seconds",
			replies: []tokenReply{oauthFailure("slow_down"), oauthFailure("authorization_pending"), approved()},
			delays:  []time.Duration{pollInterval, slowedPollInterval, slowedPollInterval},
		},
		{
			name: "unavailable respects Retry-After",
			replies: []tokenReply{
				{status: http.StatusServiceUnavailable, body: map[string]string{}, retryAfter: strconv.Itoa(testRetryAfter)},
				approved(),
			},
			delays: []time.Duration{pollInterval, testRetryAfter * time.Second},
		},
		{
			name:    "expired code stops polling",
			replies: []tokenReply{oauthFailure("authorization_pending"), oauthFailure("expired_token")},
			want:    control.ErrDeviceCodeExpired,
			delays:  []time.Duration{pollInterval, pollInterval},
		},
		{
			name:    "denied approval stops polling",
			replies: []tokenReply{oauthFailure("access_denied")},
			want:    control.ErrDeviceDenied,
			delays:  []time.Duration{pollInterval},
		},
		{
			name:    "invalid grant stops polling",
			replies: []tokenReply{oauthFailure("invalid_grant")},
			want:    control.ErrDeviceGrantInvalid,
			delays:  []time.Duration{pollInterval},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mux := http.NewServeMux()
			mux.Handle(deviceTokenAPI, &tokenEndpoint{t: t, replies: test.replies})
			server := httptest.NewServer(mux)
			t.Cleanup(server.Close)
			waits := &recordedWaits{}
			token, err := control.AwaitDeviceToken(t.Context(), server.URL, testAuthorization(), waits.wait)
			if test.want != nil {
				if !errors.Is(err, test.want) {
					t.Fatalf("error = %v, want %v", err, test.want)
				}
			} else if err != nil || token != testAccessToken {
				t.Fatalf("token = %q, %v; want %q", token, err, testAccessToken)
			}
			if !slices.Equal(waits.delays, test.delays) {
				t.Fatalf("poll delays = %v, want %v", waits.delays, test.delays)
			}
		})
	}
}

func TestAwaitDeviceTokenStopsWhenCancelled(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle(deviceTokenAPI, &tokenEndpoint{t: t, replies: []tokenReply{oauthFailure("authorization_pending")}})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	waits := &recordedWaits{}
	if _, err := control.AwaitDeviceToken(ctx, server.URL, testAuthorization(), waits.wait); !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v, want context cancellation", err)
	}
}
