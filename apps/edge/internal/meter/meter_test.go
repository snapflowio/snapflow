// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"errors"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/control/controltest"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/statefile"
	"github.com/snapflowio/edge/internal/traffic"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type scriptedUsageAPI struct {
	failures   []error
	received   []apiclient.EdgeUsageCheckpointDto
	epoch      int32
	lastDigest string
}

func (api *scriptedUsageAPI) OpenUsageEpoch(ctx context.Context) (*apiclient.EdgeUsageEpochDto, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	api.epoch++
	opened := &apiclient.EdgeUsageEpochDto{UsageEpoch: api.epoch}
	if api.lastDigest != "" {
		anchor := api.lastDigest
		opened.PreviousDigest = &anchor
	}
	return opened, nil
}

func (api *scriptedUsageAPI) IngestUsageCheckpoint(
	ctx context.Context,
	checkpoint apiclient.EdgeUsageCheckpointDto,
) (*apiclient.EdgeUsageCheckpointAcknowledgementDto, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	api.received = append(api.received, checkpoint)
	if len(api.failures) > 0 {
		failure := api.failures[0]
		api.failures = api.failures[1:]
		return nil, failure
	}
	api.lastDigest = checkpoint.Digest
	return &apiclient.EdgeUsageCheckpointAcknowledgementDto{
		UsageEpoch: checkpoint.UsageEpoch,
		Sequence:   checkpoint.Sequence,
		Digest:     checkpoint.Digest,
	}, nil
}

type testSession struct {
	credentials control.Credentials
	expiresAt   time.Time
}

func (session *testSession) Credentials() control.Credentials { return session.credentials }

func (session *testSession) Expiry() time.Time { return session.expiresAt }

func newTestMeter(t *testing.T, control API, session *testSession) *Meter {
	t.Helper()
	store, err := routes.OpenStore(t.TempDir(), testEdgeID, func() int32 {
		return session.credentials.Generation
	})
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	meter, err := Open(t.TempDir(), Dependencies{API: control, Routes: store, Signer: newTestSigner(t), Session: session})
	if err != nil {
		t.Fatalf("open usage meter: %v", err)
	}
	return meter
}

func enqueueTestIntervals(t *testing.T, meter *Meter, count int) {
	t.Helper()
	for index := range count {
		if err := meter.intervals.enqueue(testInterval(testIntervalStart().Add(time.Duration(index) * time.Minute))); err != nil {
			t.Fatalf("enqueue interval: %v", err)
		}
	}
}

func openAttributedCounter(meter *Meter, backendID uuid.UUID, identity backendIdentity) *traffic.Counter {
	counter := meter.OpenCounter(backendID)
	meter.liveMu.Lock()
	meter.live[counter] = registration{backendID: backendID, identity: identity, attributed: true}
	meter.liveMu.Unlock()
	return counter
}

func newTestSession(now time.Time) *testSession {
	return &testSession{
		credentials: control.Credentials{
			ID: uuid.NewString(), Token: "token", Generation: 1, IssuedAt: now.Add(-time.Minute),
		},
		expiresAt: now.Add(5 * time.Minute),
	}
}

func TestFlushDiscardsPermanentlyRejectedIntervalAndReusesItsSequence(t *testing.T) {
	control := &scriptedUsageAPI{failures: []error{controltest.Failure(http.StatusUnprocessableEntity)}}
	meter := newTestMeter(t, control, newTestSession(time.Now()))
	enqueueTestIntervals(t, meter, 2)
	if err := meter.flush(context.Background()); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if len(control.received) != 2 ||
		control.received[0].Sequence != "1" || control.received[1].Sequence != "1" {
		t.Fatalf("sent checkpoints = %+v, want both intervals at sequence 1", control.received)
	}
	if snapshot := meter.Snapshot(); snapshot.DiscardedIntervals != 1 || snapshot.Samples != 0 {
		t.Fatalf("meter snapshot = %+v, want one discarded interval and an empty queue", snapshot)
	}
}

func TestFlushOpensAnEpochBeforeTheFirstCheckpoint(t *testing.T) {
	control := &scriptedUsageAPI{}
	meter := newTestMeter(t, control, newTestSession(time.Now()))
	enqueueTestIntervals(t, meter, 2)
	if err := meter.flush(context.Background()); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if control.epoch != 1 || len(control.received) != 2 {
		t.Fatalf("opened %d epochs and sent %d checkpoints, want one epoch and two checkpoints", control.epoch, len(control.received))
	}
	first, second := control.received[0], control.received[1]
	if first.UsageEpoch != 1 || first.Sequence != "1" || first.PreviousDigest != nil ||
		second.UsageEpoch != 1 || second.Sequence != "2" || second.PreviousDigest == nil ||
		*second.PreviousDigest != first.Digest {
		t.Fatalf("checkpoints = %+v, want one chain in epoch 1", control.received)
	}
}

func TestWipedStateResumesInANewEpochChainedToTheAcceptedDigest(t *testing.T) {
	control := &scriptedUsageAPI{}
	session := newTestSession(time.Now())
	original := newTestMeter(t, control, session)
	enqueueTestIntervals(t, original, 1)
	if err := original.flush(context.Background()); err != nil {
		t.Fatalf("flush before the wipe: %v", err)
	}
	accepted := control.received[0].Digest
	wiped := newTestMeter(t, control, session)
	enqueueTestIntervals(t, wiped, 1)
	if err := wiped.flush(context.Background()); err != nil {
		t.Fatalf("flush after the wipe: %v", err)
	}
	resumed := control.received[1]
	if resumed.UsageEpoch != 2 || resumed.Sequence != "1" || resumed.PreviousDigest == nil ||
		*resumed.PreviousDigest != accepted {
		t.Fatalf("checkpoint after the wipe = %+v, want epoch 2 sequence 1 chained to %s", resumed, accepted)
	}
}

func TestMeterRecoversFromCorruptUsageStateInANewEpoch(t *testing.T) {
	stateDirectory := t.TempDir()
	signer := newTestSigner(t)
	queue, err := openQueue(stateDirectory, signer.EdgeID())
	if err != nil {
		t.Fatalf("open queue: %v", err)
	}
	if err := queue.enqueue(testInterval(testIntervalStart())); err != nil {
		t.Fatalf("enqueue interval: %v", err)
	}
	if err := statefile.WriteJSON(filepath.Join(queue.root, cursorFilename), map[string]any{"sequence": 7}); err != nil {
		t.Fatalf("persist corrupt cursor: %v", err)
	}
	control := &scriptedUsageAPI{epoch: 3}
	session := newTestSession(time.Now())
	store, err := routes.OpenStore(t.TempDir(), testEdgeID, func() int32 { return session.credentials.Generation })
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	meter, err := Open(stateDirectory, Dependencies{API: control, Routes: store, Signer: signer, Session: session})
	if err != nil {
		t.Fatalf("open meter over corrupt state: %v", err)
	}
	if snapshot := meter.Snapshot(); snapshot.DiscardedIntervals != 1 || snapshot.Samples != 0 {
		t.Fatalf("meter snapshot = %+v, want the unprovable interval discarded", snapshot)
	}
	enqueueTestIntervals(t, meter, 1)
	if err := meter.flush(context.Background()); err != nil {
		t.Fatalf("flush after recovery: %v", err)
	}
	if len(control.received) != 1 || control.received[0].UsageEpoch != 4 || control.received[0].Sequence != "1" {
		t.Fatalf("checkpoints = %+v, want a fresh epoch starting at sequence 1", control.received)
	}
}

func TestFlushResignsTheHeadInANewEpochWhenTheAPIClosesTheEpoch(t *testing.T) {
	control := &scriptedUsageAPI{failures: []error{controltest.Failure(http.StatusGone)}}
	meter := newTestMeter(t, control, newTestSession(time.Now()))
	enqueueTestIntervals(t, meter, 1)
	if err := meter.flush(context.Background()); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if len(control.received) != 2 || control.received[1].UsageEpoch != 2 || control.received[1].Sequence != "1" {
		t.Fatalf("checkpoints = %+v, want the head re-signed as epoch 2 sequence 1", control.received)
	}
	if snapshot := meter.Snapshot(); snapshot.DiscardedIntervals != 0 || snapshot.Samples != 0 {
		t.Fatalf("meter snapshot = %+v, want the interval delivered", snapshot)
	}
}

func TestFlushStopsWhenTheAPIClosesAFreshEpoch(t *testing.T) {
	control := &scriptedUsageAPI{failures: []error{
		controltest.Failure(http.StatusGone),
		controltest.Failure(http.StatusGone),
	}}
	meter := newTestMeter(t, control, newTestSession(time.Now()))
	enqueueTestIntervals(t, meter, 1)
	if err := meter.flush(context.Background()); err == nil {
		t.Fatal("flush kept opening epochs for a head the API keeps closing")
	}
	if snapshot := meter.Snapshot(); snapshot.DiscardedIntervals != 0 || snapshot.Samples != 1 {
		t.Fatalf("meter snapshot = %+v, want the interval retained", snapshot)
	}
}

func TestFlushDiscardsAnIntervalThatConflictsWithTheAcceptedChain(t *testing.T) {
	control := &scriptedUsageAPI{failures: []error{controltest.Failure(http.StatusConflict)}}
	meter := newTestMeter(t, control, newTestSession(time.Now()))
	enqueueTestIntervals(t, meter, 2)
	if err := meter.flush(context.Background()); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if len(control.received) != 2 || control.received[1].UsageEpoch != 1 || control.received[1].Sequence != "1" {
		t.Fatalf("checkpoints = %+v, want the next interval at the conflicting position", control.received)
	}
	if snapshot := meter.Snapshot(); snapshot.DiscardedIntervals != 1 || snapshot.Samples != 0 {
		t.Fatalf("meter snapshot = %+v, want one discarded interval", snapshot)
	}
}

func TestFlushRetainsIntervalOnRetryableAndAuthenticationFailures(t *testing.T) {
	for _, failure := range []error{
		controltest.Failure(http.StatusServiceUnavailable),
		controltest.Failure(http.StatusUnauthorized),
		errors.New("connection refused"),
	} {
		control := &scriptedUsageAPI{failures: []error{failure}}
		meter := newTestMeter(t, control, newTestSession(time.Now()))
		if err := meter.intervals.enqueue(testInterval(testIntervalStart())); err != nil {
			t.Fatalf("enqueue interval: %v", err)
		}
		err := meter.flush(context.Background())
		if handled := meter.handleFlushError("flush", err); err == nil || handled != nil {
			t.Fatalf("flush error = %v, handled = %v; want a handled API error", err, handled)
		}
		if snapshot := meter.Snapshot(); snapshot.DiscardedIntervals != 0 || snapshot.Samples != 1 {
			t.Fatalf("%v: meter snapshot = %+v, want the interval retained", failure, snapshot)
		}
		if err := meter.flush(context.Background()); err != nil {
			t.Fatalf("retry flush: %v", err)
		}
		if control.received[0].Digest != control.received[1].Digest {
			t.Fatal("retried interval was signed with a different digest")
		}
	}
}

func TestUnattributedUsageIsDroppedWithoutStoppingTheMeter(t *testing.T) {
	now := time.Now()
	meter := newTestMeter(t, &scriptedUsageAPI{}, newTestSession(now))
	meter.OpenCounter(uuid.New()).AddIngress(100, 1)
	if err := meter.rotate(now.Add(time.Second)); err != nil {
		t.Fatalf("rotate with unattributed usage: %v", err)
	}
	if snapshot := meter.Snapshot(); snapshot.DroppedRecords != 1 || snapshot.Samples != 0 {
		t.Fatalf("meter snapshot = %+v, want one dropped record", snapshot)
	}
}

func TestUsageKeepsIdentityOfBackendThatLeftTheSnapshot(t *testing.T) {
	now := time.Now()
	meter := newTestMeter(t, &scriptedUsageAPI{}, newTestSession(now))
	openAttributedCounter(meter, uuid.New(), backendIdentity{
		assignmentGeneration: 4,
		protocol:             apiclient.NetworkProtocolTcp,
	}).AddEgress(10, 1)
	if err := meter.rotate(now.Add(time.Second)); err != nil {
		t.Fatalf("rotate: %v", err)
	}
	interval, _, err := meter.intervals.peek()
	if err != nil || interval == nil || len(interval.Samples) != 1 ||
		interval.Samples[0].AssignmentGeneration != 4 {
		t.Fatalf("queued interval = %+v (%v), want the carried backend identity", interval, err)
	}
}

func TestRotateSplitsUsageAtSessionReplacement(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Millisecond)
	session := newTestSession(now)
	meter := newTestMeter(t, &scriptedUsageAPI{}, session)
	openAttributedCounter(meter, uuid.New(), backendIdentity{
		assignmentGeneration: 1,
		protocol:             apiclient.NetworkProtocolHttp,
	}).AddConnection()
	firstExpiry := session.expiresAt
	session.credentials.Generation = 2
	session.credentials.IssuedAt = firstExpiry.Add(time.Minute)
	session.expiresAt = firstExpiry.Add(6 * time.Minute)
	if err := meter.rotate(firstExpiry.Add(2 * time.Minute)); err != nil {
		t.Fatalf("rotate across session replacement: %v", err)
	}
	interval, _, err := meter.intervals.peek()
	if err != nil || interval == nil {
		t.Fatalf("read interval: %v", err)
	}
	if interval.EdgeSessionGeneration != 1 || interval.IntervalEndedAt.After(firstExpiry) {
		t.Fatalf("interval = %+v, want generation 1 ending by %s", interval, firstExpiry)
	}
	if meter.window.generation != 2 || meter.intervalStart.Before(session.credentials.IssuedAt.Truncate(time.Millisecond)) {
		t.Fatalf("next interval starts at %s in generation %d", meter.intervalStart, meter.window.generation)
	}
}
