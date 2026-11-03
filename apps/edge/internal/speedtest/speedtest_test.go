// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	testKeyID            = "ed25519:test"
	testUploadBytes      = 3 << 20
	testBudgetBytes      = 100 << 10
	testClockStep        = 250 * time.Millisecond
	testSeconds          = 4
	guestParallelStreams = 8
)

type testSigner struct {
	key ed25519.PrivateKey
}

func (signer testSigner) KeyID() string { return testKeyID }

func (signer testSigner) Sign(payload []byte) (string, error) {
	return base64.RawURLEncoding.EncodeToString(ed25519.Sign(signer.key, payload)), nil
}

type testClock struct {
	start  time.Time
	step   time.Duration
	ticks  atomic.Int64
	offset atomic.Int64
}

func newTestClock(start time.Time) *testClock {
	return newSteppedClock(start, testClockStep)
}

func newSteppedClock(start time.Time, step time.Duration) *testClock {
	return &testClock{start: start, step: step}
}

func (clock *testClock) now() time.Time {
	return clock.start.Add(time.Duration(clock.ticks.Add(1))*clock.step + time.Duration(clock.offset.Load()))
}

func (clock *testClock) advance(duration time.Duration) {
	clock.offset.Add(int64(duration))
}

func newTestHandler(t *testing.T, keys KeySource, clock *testClock) *Handler {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	handler, err := New(testSigner{key: privateKey}, keys, WithClock(clock.now))
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

type testServer struct {
	*httptest.Server
	publicKey ed25519.PublicKey
	token     string
}

func newTestServer(t *testing.T, budget uint64, clockStep time.Duration) testServer {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	source := &fakeKeySource{}
	source.publish(t, vectorKeyID, vectorKey())
	clock := newSteppedClock(vectorExpiresAt().Add(-time.Hour), clockStep)
	handler, err := New(testSigner{key: privateKey}, source, WithClock(clock.now))
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewUnstartedServer(handler)
	server.Config.ConnContext = ConnContext
	server.Start()
	t.Cleanup(server.Close)
	fixture := vectorFixture()
	fixture.byteBudget = budget
	return testServer{Server: server, publicKey: publicKey, token: fixture.mint()}
}

func authorized(t *testing.T, token, method, target string, body io.Reader) *http.Request {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), method, target, body)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set(authorizationHeader, bearerPrefix+token)
	return request
}

func send(t *testing.T, request *http.Request) (*http.Response, []byte) {
	t.Helper()
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if err := response.Body.Close(); err != nil {
		t.Fatal(err)
	}
	return response, body
}

func verifyReceipt(t *testing.T, server testServer, encoded []byte, direction machinev1alpha1.SpeedtestDirection, minBytes, maxBytes uint64) *machinev1alpha1.SpeedtestReceipt {
	t.Helper()
	receipt := &machinev1alpha1.SpeedtestReceipt{}
	if err := protojson.Unmarshal(encoded, receipt); err != nil {
		t.Fatal(err)
	}
	if receipt.GetDirection() != direction || receipt.GetBytes() < minBytes || receipt.GetBytes() > maxBytes ||
		receipt.GetEdgeKeyId() != testKeyID || receipt.GetSentSegments() == 0 ||
		!receipt.GetFinishedAt().AsTime().After(receipt.GetStartedAt().AsTime()) {
		t.Fatalf("receipt = %v, want %d to %d bytes", receipt, minBytes, maxBytes)
	}
	message := receiptMessage(&transfer{
		token: server.token, direction: direction,
		startedAt: receipt.GetStartedAt().AsTime(), finishedAt: receipt.GetFinishedAt().AsTime(),
		meter: meter{
			rampEnd: receipt.GetMeasuredStartedAt().AsTime(), total: receipt.GetBytes(), measured: receipt.GetMeasuredBytes(),
		},
		stats: tcpStats{
			minRTTMicros: receipt.GetMinRttMicros(), smoothedRTTMicros: receipt.GetSmoothedRttMicros(),
			rttVarianceMicros: receipt.GetRttVarianceMicros(), retransmittedSegments: receipt.GetRetransmittedSegments(),
			sentSegments: receipt.GetSentSegments(),
		},
	})
	if !ed25519.Verify(server.publicKey, message, receipt.GetSignature()) {
		t.Fatal("the receipt signature does not verify")
	}
	return receipt
}

func download(t *testing.T, server testServer) (body []byte, trailer string) {
	t.Helper()
	target := server.URL + downloadPath + "?" + secondsQuery + "=" + strconv.Itoa(testSeconds)
	response, body := send(t, authorized(t, server.token, http.MethodGet, target, http.NoBody))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("download status = %d: %s", response.StatusCode, body)
	}
	return body, response.Trailer.Get(receiptTrailer)
}

func decodeTrailer(t *testing.T, trailer string) []byte {
	t.Helper()
	receipt, err := base64.RawURLEncoding.DecodeString(trailer)
	if err != nil {
		t.Fatal(err)
	}
	return receipt
}

func TestDownloadMeasuresOnlyBytesWrittenAfterTheRamp(t *testing.T) {
	server := newTestServer(t, vectorByteBudget, testClockStep)
	body, trailer := download(t, server)
	steps := int(time.Duration(testSeconds) * time.Second / testClockStep)
	rampSteps := int(rampDuration / testClockStep)
	if len(body) != (steps-1)*transferChunkBytes {
		t.Fatalf("downloaded %d bytes, want %d chunks", len(body), steps-1)
	}
	total := uint64(len(body))
	receipt := verifyReceipt(t, server, decodeTrailer(t, trailer), machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_DOWNLOAD, total, total)
	if want := uint64((steps - rampSteps) * transferChunkBytes); receipt.GetMeasuredBytes() != want {
		t.Fatalf("measured %d bytes, want %d", receipt.GetMeasuredBytes(), want)
	}
	window := receipt.GetFinishedAt().AsTime().Sub(receipt.GetMeasuredStartedAt().AsTime())
	if want := time.Duration(testSeconds)*time.Second - rampDuration + testClockStep; window != want {
		t.Fatalf("measured window = %s, want %s", window, want)
	}
}

func TestUploadMeasuresOnlyBytesReadAfterTheRamp(t *testing.T) {
	clock := newTestClock(vectorExpiresAt())
	counter := &meter{rampEnd: clock.now().Add(rampDuration)}
	reader := meteredReader{source: bytes.NewReader(make([]byte, testUploadBytes)), meter: counter, now: clock.now}
	buffer := make([]byte, transferChunkBytes)
	for {
		_, err := reader.Read(buffer)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	rampReads := int(rampDuration / testClockStep)
	if want := uint64(testUploadBytes - (rampReads-1)*transferChunkBytes); counter.measured != want || counter.total != testUploadBytes {
		t.Fatalf("counted %d of %d bytes, want %d of %d", counter.measured, counter.total, want, testUploadBytes)
	}
}

func TestUploadReturnsASignedReceipt(t *testing.T) {
	server := newTestServer(t, vectorByteBudget, rampDuration)
	response, receipt := send(t, authorized(t, server.token, http.MethodPost, server.URL+uploadPath, bytes.NewReader(make([]byte, testUploadBytes))))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("upload status = %d: %s", response.StatusCode, receipt)
	}
	verifyReceipt(t, server, receipt, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD, testUploadBytes, testUploadBytes)
}

func TestUploadEndingDuringTheRampMeasuresNothing(t *testing.T) {
	server := newTestServer(t, vectorByteBudget, testClockStep)
	response, body := send(t, authorized(t, server.token, http.MethodPost, server.URL+uploadPath, bytes.NewReader([]byte{1})))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("upload during the ramp got HTTP %d: %s", response.StatusCode, body)
	}
	if receipt := verifyReceipt(t, server, body, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD, 1, 1); receipt.GetMeasuredBytes() != 0 {
		t.Fatalf("measured %d bytes during the ramp", receipt.GetMeasuredBytes())
	}
}

func TestTransfersStopAtTheBenchmarkByteBudget(t *testing.T) {
	server := newTestServer(t, testBudgetBytes, testClockStep)
	body, trailer := download(t, server)
	if len(body) != testBudgetBytes {
		t.Fatalf("downloaded %d bytes, want the %d byte budget", len(body), testBudgetBytes)
	}
	verifyReceipt(t, server, decodeTrailer(t, trailer), machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_DOWNLOAD, testBudgetBytes, testBudgetBytes)
	response, message := send(t, authorized(t, server.token, http.MethodPost, server.URL+uploadPath, bytes.NewReader([]byte{1})))
	if response.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("upload after the budget got HTTP %d: %s", response.StatusCode, message)
	}
}

func TestUploadOfExactlyTheBudgetSucceeds(t *testing.T) {
	server := newTestServer(t, testBudgetBytes, rampDuration)
	response, receipt := send(t, authorized(t, server.token, http.MethodPost, server.URL+uploadPath, bytes.NewReader(make([]byte, testBudgetBytes))))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("upload status = %d: %s", response.StatusCode, receipt)
	}
	verifyReceipt(t, server, receipt, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD, testBudgetBytes, testBudgetBytes)
}

func TestTransfersRequireAValidToken(t *testing.T) {
	server := newTestServer(t, vectorByteBudget, testClockStep)
	token := server.token
	for _, candidate := range []string{"", "not-a-token", vectorKeyID + ".short", "unknown" + token[len(vectorKeyID):], token + "A"} {
		response, body := send(t, authorized(t, candidate, http.MethodPost, server.URL+uploadPath, http.NoBody))
		if response.StatusCode != http.StatusUnauthorized {
			t.Errorf("token %q got HTTP %d, want 401: %s", candidate, response.StatusCode, body)
		}
	}
}

func TestDownloadRejectsDurationsOutOfRange(t *testing.T) {
	server := newTestServer(t, vectorByteBudget, testClockStep)
	for _, seconds := range []string{"0", "31", "forever"} {
		response, body := send(t, authorized(t, server.token, http.MethodGet, server.URL+downloadPath+"?"+secondsQuery+"="+seconds, http.NoBody))
		if response.StatusCode != http.StatusBadRequest {
			t.Errorf("seconds %q got HTTP %d, want 400: %s", seconds, response.StatusCode, body)
		}
	}
}

func TestReceiptMessageMatchesTheSigningContract(t *testing.T) {
	message := receiptMessage(&transfer{
		token:      vectorToken,
		direction:  machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD,
		startedAt:  time.UnixMilli(1760446800123),
		finishedAt: time.UnixMilli(1760446812456),
		meter:      meter{rampEnd: time.UnixMilli(1760446803123), total: 1234567890, measured: 1000000000},
		stats:      tcpStats{minRTTMicros: 1500, smoothedRTTMicros: 2100, rttVarianceMicros: 300, retransmittedSegments: 7, sentSegments: 90000},
	})
	want := "snapflow.speedtest-receipt.v2\n" + vectorToken + "\nupload\n1234567890\n1760446800123\n1760446812456\n1000000000\n1760446803123\n1500\n2100\n300\n7\n90000"
	if string(message) != want {
		t.Fatalf("receipt message = %q, want %q", message, want)
	}
}

func TestTransferLimitsFitTheGuestStreams(t *testing.T) {
	if maximumBenchmarkTransfers < guestParallelStreams || maximumTransfers < maximumBenchmarkTransfers {
		t.Fatalf("limits %d per benchmark and %d per Edge cannot host %d guest streams", maximumBenchmarkTransfers, maximumTransfers, guestParallelStreams)
	}
	ledger := newBudgetLedger()
	now := vectorExpiresAt().Add(-time.Hour)
	claims := tokenClaims{benchmarkID: uuid.New(), expiresAt: vectorExpiresAt(), byteBudget: vectorByteBudget}
	for stream := range maximumBenchmarkTransfers {
		if _, opened := ledger.open(claims, now); !opened {
			t.Fatalf("transfer %d of a benchmark was refused", stream)
		}
	}
	if _, opened := ledger.open(claims, now); opened {
		t.Fatalf("a benchmark opened more than %d transfers", maximumBenchmarkTransfers)
	}
	if handler := newTestHandler(t, &fakeKeySource{}, newTestClock(now)); cap(handler.transfers) != maximumTransfers {
		t.Fatalf("the Edge admits %d transfers, want %d", cap(handler.transfers), maximumTransfers)
	}
}
