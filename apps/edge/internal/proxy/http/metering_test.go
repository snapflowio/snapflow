// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"bufio"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/snapflowio/edge/internal/routes"
)

const (
	uploadedBody          = "an uploaded request body"
	responseHeaderPadding = 4 << 10
	firstUploadChunk      = "first chunk of a long upload"
	lastUploadChunk       = "and the rest of it"
	upgradeProtocol       = "echo"
	upgradedPayload       = "bytes sent over the upgraded connection"
	upgradeRequest        = "GET / HTTP/1.1\r\nHost: " + meteringTestHost +
		"\r\nUpgrade: " + upgradeProtocol + "\r\nConnection: Upgrade\r\n\r\n"
	switchingResponse = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: " + upgradeProtocol +
		"\r\nConnection: Upgrade\r\n\r\n"
	http2Major = 2
)

var errTunnelUnavailable = errors.New("tunnel unavailable")

func echoBackend(t *testing.T) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if _, err := io.Copy(writer, request.Body); err != nil {
			t.Errorf("backend echo: %v", err)
		}
	})
}

func postEcho(t *testing.T, client *http.Client, frontend string) *http.Response {
	t.Helper()
	request := newMeteringRequest(t, http.MethodPost, frontend, strings.NewReader(uploadedBody))
	request.Header.Set("Content-Type", "text/plain")
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("post through the edge: %v", err)
	}
	defer response.Body.Close()
	echoed, err := io.ReadAll(response.Body)
	if err != nil || string(echoed) != uploadedBody {
		t.Fatalf("echoed body = %q (%v), want the uploaded body", echoed, err)
	}
	return response
}

func assertBodiesMetered(t *testing.T, fixture *meteringFixture) {
	t.Helper()
	totals := fixture.waitServed(t)
	if totals.BytesIn != uint64(len(uploadedBody)) || totals.BytesOut != uint64(len(uploadedBody)) ||
		totals.Connections != 1 {
		t.Fatalf("metered %+v, want both bodies and one request", totals)
	}
}

func TestProxyMetersRequestAndResponseBodies(t *testing.T) {
	t.Parallel()
	backend := httptest.NewServer(echoBackend(t))
	defer backend.Close()
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, routes.HTTPPolicy{})
	frontend := httptest.NewServer(fixture.handler())
	defer frontend.Close()
	postEcho(t, frontend.Client(), frontend.URL)
	assertBodiesMetered(t, fixture)
}

func TestLargeResponseIsMeteredAsBodyBytesOnly(t *testing.T) {
	t.Parallel()
	const responseBytes = 3 << 20
	backend := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("X-Padding", strings.Repeat("h", responseHeaderPadding))
		if _, err := writer.Write(make([]byte, responseBytes)); err != nil {
			t.Errorf("backend write: %v", err)
		}
	}))
	defer backend.Close()
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, routes.HTTPPolicy{})
	frontend := httptest.NewServer(fixture.handler())
	defer frontend.Close()
	response, err := frontend.Client().Do(newMeteringRequest(t, http.MethodGet, frontend.URL, http.NoBody))
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	received, err := io.Copy(io.Discard, response.Body)
	if closeErr := response.Body.Close(); err == nil {
		err = closeErr
	}
	if err != nil || received != responseBytes {
		t.Fatalf("downloaded %d bytes (%v), want %d", received, err, responseBytes)
	}
	if totals := fixture.waitServed(t); totals.BytesOut != responseBytes || totals.BytesIn != 0 {
		t.Fatalf("metered %+v, want exactly the %d response body bytes and no headers", totals, responseBytes)
	}
}

func TestProxyMetersRequestBodyAsItStreams(t *testing.T) {
	t.Parallel()
	chunkReceived := make(chan struct{})
	release := make(chan struct{})
	backend := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if _, err := io.ReadFull(request.Body, make([]byte, len(firstUploadChunk))); err != nil {
			t.Errorf("backend read first chunk: %v", err)
		}
		close(chunkReceived)
		<-release
		if _, err := io.Copy(io.Discard, request.Body); err != nil {
			t.Errorf("backend read the rest: %v", err)
		}
	}))
	defer backend.Close()
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, routes.HTTPPolicy{})
	frontend := httptest.NewServer(fixture.handler())
	defer frontend.Close()

	body, upload := io.Pipe()
	responded := make(chan error, 1)
	request := newMeteringRequest(t, http.MethodPost, frontend.URL, body)
	request.Header.Set("Content-Type", "text/plain")
	go func() {
		response, err := frontend.Client().Do(request)
		if err == nil {
			err = response.Body.Close()
		}
		responded <- err
	}()
	if _, err := io.WriteString(upload, firstUploadChunk); err != nil {
		t.Fatalf("upload first chunk: %v", err)
	}
	<-chunkReceived
	inFlight := fixture.waitForIngress(t, uint64(len(firstUploadChunk)))
	if inFlight.BytesIn != uint64(len(firstUploadChunk)) || inFlight.Connections != 0 {
		t.Fatalf("metered %+v mid-upload, want the first chunk before the request completes", inFlight)
	}
	close(release)
	if _, err := io.WriteString(upload, lastUploadChunk); err != nil {
		t.Fatalf("upload last chunk: %v", err)
	}
	if err := upload.Close(); err != nil {
		t.Fatalf("finish upload: %v", err)
	}
	if err := <-responded; err != nil {
		t.Fatalf("streamed upload: %v", err)
	}
	if totals := fixture.waitServed(t); totals.BytesIn != uint64(len(firstUploadChunk+lastUploadChunk)) {
		t.Fatalf("metered %+v, want the whole upload", totals)
	}
}

func upgradeEchoBackend(t *testing.T) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		connection, buffered, err := http.NewResponseController(writer).Hijack()
		if err != nil {
			t.Errorf("backend hijack: %v", err)
			return
		}
		defer connection.Close()
		if _, err := io.WriteString(connection, switchingResponse); err != nil {
			t.Errorf("backend switch protocols: %v", err)
			return
		}
		if _, err := io.Copy(connection, buffered); err != nil {
			t.Errorf("backend echo: %v", err)
		}
	})
}

type countingReader struct {
	io.Reader
	count int
}

func (reader *countingReader) Read(destination []byte) (int, error) {
	read, err := reader.Reader.Read(destination)
	reader.count += read
	return read, err
}

func TestUpgradedConnectionIsMeteredInBothDirections(t *testing.T) {
	t.Parallel()
	backend := httptest.NewServer(upgradeEchoBackend(t))
	defer backend.Close()
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, routes.HTTPPolicy{})
	frontend := httptest.NewServer(fixture.handler())
	defer frontend.Close()

	var dialer net.Dialer
	client, err := dialer.DialContext(t.Context(), meteringTestTCPNetwork, frontend.Listener.Addr().String())
	if err != nil {
		t.Fatalf("dial the edge: %v", err)
	}
	defer client.Close()
	received := &countingReader{Reader: client}
	reader := bufio.NewReader(received)
	if _, err := io.WriteString(client, upgradeRequest); err != nil {
		t.Fatalf("send upgrade request: %v", err)
	}
	response, err := http.ReadResponse(reader, nil)
	if err != nil || response.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("upgrade response = %v (%v), want 101", response, err)
	}
	if _, err := io.WriteString(client, upgradedPayload); err != nil {
		t.Fatalf("send upgraded payload: %v", err)
	}
	echoed := make([]byte, len(upgradedPayload))
	if _, err := io.ReadFull(reader, echoed); err != nil || string(echoed) != upgradedPayload {
		t.Fatalf("echoed payload = %q (%v)", echoed, err)
	}
	if err := client.Close(); err != nil {
		t.Fatalf("close the client: %v", err)
	}
	totals := fixture.waitServed(t)
	if totals.BytesIn != uint64(len(upgradedPayload)) || totals.BytesOut != uint64(received.count) ||
		totals.Connections != 1 {
		t.Fatalf("metered %+v, want %d bytes in and the %d bytes the client received",
			totals, len(upgradedPayload), received.count)
	}
}

func TestEdgeErrorPagesAreNotMetered(t *testing.T) {
	t.Parallel()
	fixture := newMeteringFixture(t, dialingTunnel{err: errTunnelUnavailable}, routes.HTTPPolicy{})
	frontend := httptest.NewServer(fixture.handler())
	defer frontend.Close()
	response, err := frontend.Client().Do(newMeteringRequest(t, http.MethodGet, frontend.URL, http.NoBody))
	if err != nil {
		t.Fatalf("request through the edge: %v", err)
	}
	page, err := io.ReadAll(response.Body)
	if closeErr := response.Body.Close(); err != nil || closeErr != nil {
		t.Fatalf("read error page: %v", errors.Join(err, closeErr))
	}
	if response.StatusCode != http.StatusBadGateway || len(page) == 0 {
		t.Fatalf("response = %d %q, want the edge's upstream error page", response.StatusCode, page)
	}
	if totals := fixture.waitServed(t); totals.BytesOut != 0 || totals.Connections != 1 {
		t.Fatalf("metered %+v, want the request counted and its error page unmetered", totals)
	}
}

func TestH2CUpstreamBodiesAreMetered(t *testing.T) {
	t.Parallel()
	echo := echoBackend(t)
	backend := httptest.NewUnstartedServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.ProtoMajor != http2Major {
			t.Errorf("backend protocol = %s, want cleartext HTTP/2", request.Proto)
		}
		echo.ServeHTTP(writer, request)
	}))
	backend.Config.Protocols = new(http.Protocols)
	backend.Config.Protocols.SetUnencryptedHTTP2(true)
	backend.Start()
	defer backend.Close()
	policy := routes.HTTPPolicy{UpstreamProtocol: routes.HTTPUpstreamH2C}
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, policy)
	frontend := httptest.NewServer(fixture.handler())
	defer frontend.Close()
	postEcho(t, frontend.Client(), frontend.URL)
	assertBodiesMetered(t, fixture)
}

func TestHTTP2ClientStreamsAreMetered(t *testing.T) {
	t.Parallel()
	backend := httptest.NewServer(echoBackend(t))
	defer backend.Close()
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, routes.HTTPPolicy{})
	frontend := httptest.NewUnstartedServer(fixture.handler())
	frontend.EnableHTTP2 = true
	frontend.StartTLS()
	defer frontend.Close()
	if response := postEcho(t, frontend.Client(), frontend.URL); response.ProtoMajor != http2Major {
		t.Fatalf("client protocol = %s, want HTTP/2", response.Proto)
	}
	assertBodiesMetered(t, fixture)
}

func newMeteringRequest(t *testing.T, method, target string, body io.Reader) *http.Request {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), method, target, body)
	if err != nil {
		t.Fatalf("create %s request: %v", method, err)
	}
	return request
}
