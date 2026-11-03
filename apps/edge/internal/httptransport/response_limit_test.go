// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package httptransport

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (function roundTripperFunc) RoundTrip(
	request *http.Request,
) (*http.Response, error) {
	return function(request)
}

func TestBoundedResponseTransportAcceptsBodyAtLimit(t *testing.T) {
	t.Parallel()
	transport, err := NewBoundedResponseTransport(
		responseTransport("1234"),
		4,
	)
	if err != nil {
		t.Fatalf("create transport: %v", err)
	}
	response, err := transport.RoundTrip(testRequest(t))
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}
	defer closeResponse(t, response)
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	if string(payload) != "1234" {
		t.Fatalf("response = %q, want %q", payload, "1234")
	}
}

func TestBoundedResponseTransportRejectsOversizedBody(t *testing.T) {
	t.Parallel()
	transport, err := NewBoundedResponseTransport(
		responseTransport("12345"),
		4,
	)
	if err != nil {
		t.Fatalf("create transport: %v", err)
	}
	response, err := transport.RoundTrip(testRequest(t))
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}
	defer closeResponse(t, response)
	payload, err := io.ReadAll(response.Body)
	if !errors.Is(err, ErrResponseBodyTooLarge) {
		t.Fatalf("read error = %v, want response-size error", err)
	}
	if string(payload) != "1234" {
		t.Fatalf("bounded payload = %q, want %q", payload, "1234")
	}
}

func TestBoundedResponseTransportRequiresPositiveLimit(t *testing.T) {
	t.Parallel()
	if _, err := NewBoundedResponseTransport(http.DefaultTransport, 0); err == nil {
		t.Fatal("zero response limit was accepted")
	}
}

func responseTransport(payload string) http.RoundTripper {
	return roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(payload)),
			Request:    request,
		}, nil
	})
}

func testRequest(t *testing.T) *http.Request {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "https://api.example.test", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	return request
}

func closeResponse(t *testing.T, response *http.Response) {
	t.Helper()
	if err := response.Body.Close(); err != nil {
		t.Errorf("close response: %v", err)
	}
}
