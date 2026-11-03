// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	testPlanDigest           = "0000000000000000000000000000000000000000000000000000000000000001"
	testRejectedPlanDigest   = "0000000000000000000000000000000000000000000000000000000000000002"
	testHeldReadDuration     = 3 * minimumTunnelPlanReadInterval
	testImmediateReadBound   = minimumTunnelPlanReadInterval
	testWatcherDeadline      = 5 * time.Second
	testStartupRetryDeadline = 30 * time.Second
)

var errTransientControl = errors.New("transient control-plane failure")

type planControlEvent struct {
	name string
	at   time.Time
}

type scriptedPlanControl struct {
	mu                sync.Mutex
	events            []planControlEvent
	readDeadlines     []time.Duration
	holdFirstRead     time.Duration
	fetchErr          error
	transientFailures int
	firstDocument     *apiclient.MachineTunnelPlanDto
	acknowledgeErr    []error
	signal            chan struct{}
}

func newScriptedPlanControl() *scriptedPlanControl {
	return &scriptedPlanControl{signal: make(chan struct{}, 64)}
}

func (control *scriptedPlanControl) record(name string) {
	control.mu.Lock()
	control.events = append(control.events, planControlEvent{name: name, at: time.Now()})
	control.mu.Unlock()
	select {
	case control.signal <- struct{}{}:
	default:
	}
}

func (control *scriptedPlanControl) snapshot() []planControlEvent {
	control.mu.Lock()
	defer control.mu.Unlock()
	return slices.Clone(control.events)
}

func (control *scriptedPlanControl) names() []string {
	events := control.snapshot()
	names := make([]string, 0, len(events))
	for _, event := range events {
		names = append(names, event.name)
	}
	return names
}

func (control *scriptedPlanControl) waitForEvents(t *testing.T, count int) []planControlEvent {
	t.Helper()
	deadline := time.After(testWatcherDeadline)
	for {
		if events := control.snapshot(); len(events) >= count {
			return events
		}
		select {
		case <-control.signal:
		case <-deadline:
			t.Fatalf("expected %d control events, got %v", count, control.names())
		}
	}
}

func (control *scriptedPlanControl) FetchPlan(
	ctx context.Context,
	digest string,
) (*apiclient.MachineTunnelPlanDto, bool, error) {
	control.mu.Lock()
	hold := control.holdFirstRead
	control.holdFirstRead = 0
	failTransiently := control.transientFailures > 0
	if failTransiently {
		control.transientFailures--
	}
	document := control.firstDocument
	control.firstDocument = nil
	if deadline, ok := ctx.Deadline(); ok {
		control.readDeadlines = append(control.readDeadlines, time.Until(deadline))
	}
	control.mu.Unlock()
	control.record("fetch:" + digest)
	if failTransiently {
		return nil, false, errTransientControl
	}
	if control.fetchErr != nil {
		return nil, false, control.fetchErr
	}
	if document != nil {
		return document, true, nil
	}
	select {
	case <-ctx.Done():
		return nil, false, ctx.Err()
	case <-time.After(hold):
	}
	return nil, false, nil
}

func (control *scriptedPlanControl) AcknowledgeTargetPlan(context.Context, plan.Binding) error {
	control.mu.Lock()
	var err error
	if len(control.acknowledgeErr) > 0 {
		err = control.acknowledgeErr[0]
		control.acknowledgeErr = control.acknowledgeErr[1:]
	}
	control.mu.Unlock()
	if err != nil {
		control.record("acknowledge:failed")
		return err
	}
	control.record("acknowledge:ok")
	return nil
}

func (control *scriptedPlanControl) AcknowledgeBinding(
	context.Context,
	plan.Binding,
	uuid.UUID,
	*transport.Session,
) error {
	return errors.New("binding acknowledgement is not scripted")
}

func managerWithPlan(control tunnelControl) *Manager {
	manager := &Manager{
		log:            slog.New(slog.NewTextHandler(io.Discard, nil)),
		control:        control,
		observedDigest: testPlanDigest,
	}
	bindingID := uuid.New()
	manager.current.Store(&plan.Plan{
		Digest:    testPlanDigest,
		ExpiresAt: time.Now().Add(time.Minute),
		Bindings: map[uuid.UUID]plan.Binding{
			bindingID: {
				EdgeID:   uuid.New(),
				Identity: protocol.Binding{ID: bindingID, Revision: 1, Digest: testPlanDigest},
			},
		},
	})
	return manager
}

func startWatcher(t *testing.T, manager *Manager) <-chan error {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	result := make(chan error, 1)
	go func() { result <- manager.watchPlans(ctx) }()
	return result
}

func TestWatchPlansLongPollsWithoutAPollingDelay(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	scripted.holdFirstRead = testHeldReadDuration
	startWatcher(t, managerWithPlan(scripted))

	events := scripted.waitForEvents(t, 4)
	if events[0].name != "fetch:"+testPlanDigest {
		t.Fatalf("first read = %q, want a conditional read of the current plan", events[0].name)
	}
	secondRead := slices.IndexFunc(events[1:], func(event planControlEvent) bool {
		return event.name == events[0].name
	}) + 1
	if secondRead == 0 {
		t.Fatalf("watcher did not read the plan again: %v", scripted.names())
	}
	if gap := events[secondRead].at.Sub(events[0].at) - testHeldReadDuration; gap > testImmediateReadBound {
		t.Fatalf("next read started %s after the held read returned, want an immediate read", gap)
	}
	scripted.mu.Lock()
	firstDeadline := scripted.readDeadlines[0]
	scripted.mu.Unlock()
	if firstDeadline <= tunnelPlanWait {
		t.Fatalf("plan read deadline = %s, want more than the %s long-poll wait", firstDeadline, tunnelPlanWait)
	}
}

func TestWatchPlansRetriesFailedAcknowledgementBeforeTheNextRead(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	scripted.acknowledgeErr = []error{errTransientControl}
	manager := managerWithPlan(scripted)
	manager.acknowledgementPending = true
	startWatcher(t, manager)

	scripted.waitForEvents(t, 4)
	want := []string{
		"acknowledge:failed",
		"acknowledge:ok",
		"fetch:" + testPlanDigest,
		"fetch:" + testPlanDigest,
	}
	if got := scripted.names()[:len(want)]; !slices.Equal(got, want) {
		t.Fatalf("control events = %v, want %v", got, want)
	}
}

func TestRefreshDoesNotReacknowledgeAnUnchangedPlan(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	manager := managerWithPlan(scripted)
	for range 2 {
		if err := manager.refresh(context.Background(), context.Background()); err != nil {
			t.Fatalf("refresh an unchanged plan: %v", err)
		}
	}
	want := []string{"fetch:" + testPlanDigest, "fetch:" + testPlanDigest}
	if got := scripted.names(); !slices.Equal(got, want) {
		t.Fatalf("control events = %v, want %v", got, want)
	}
}

func TestWatchPlansIgnoresSupersededTargetPlans(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	scripted.acknowledgeErr = []error{&apierror.Error{
		Operation:  "acknowledge Machine tunnel target plan",
		StatusCode: http.StatusConflict,
		Cause:      errTransientControl,
	}}
	manager := managerWithPlan(scripted)
	manager.acknowledgementPending = true

	if err := manager.refresh(context.Background(), context.Background()); err != nil {
		t.Fatalf("refresh with a superseded target plan: %v", err)
	}
	if manager.acknowledgementPending {
		t.Fatal("a superseded target plan was left pending acknowledgement")
	}
}

func TestWatchPlansWaitsOnARejectedPlanInsteadOfBackingOff(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	scripted.firstDocument = &apiclient.MachineTunnelPlanDto{
		MachineId: uuid.New(),
		Digest:    testRejectedPlanDigest,
	}
	manager := managerWithPlan(scripted)
	startWatcher(t, manager)

	events := scripted.waitForEvents(t, 2)
	if events[1].name != "fetch:"+testRejectedPlanDigest {
		t.Fatalf("read after a rejected plan = %q, want a conditional read of the rejected digest", events[1].name)
	}
	if current := manager.current.Load(); current == nil || current.Digest != testPlanDigest {
		t.Fatal("rejected plan replaced the last-known-good plan")
	}
}

func TestWatchPlansStopsOnPermanentRejection(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	scripted.fetchErr = &apierror.Error{
		Operation:  "fetch Machine tunnel plan",
		StatusCode: http.StatusUnauthorized,
		Cause:      errTransientControl,
	}
	result := startWatcher(t, managerWithPlan(scripted))

	select {
	case err := <-result:
		if !permanentControlError(err) {
			t.Fatalf("watcher returned %v, want the permanent rejection", err)
		}
	case <-time.After(testWatcherDeadline):
		t.Fatal("watcher kept polling after a permanent rejection")
	}
}

func TestRefreshUntilAcceptedRetriesTransientStartupFailures(t *testing.T) {
	t.Parallel()
	const transientFailures = 2
	scripted := newScriptedPlanControl()
	scripted.transientFailures = transientFailures
	manager := managerWithPlan(scripted)
	ctx, cancel := context.WithTimeout(context.Background(), testStartupRetryDeadline)
	defer cancel()

	if err := manager.refreshUntilAccepted(ctx, ctx); err != nil {
		t.Fatalf("refreshUntilAccepted returned %v after transient failures", err)
	}
	fetches := 0
	for _, name := range scripted.names() {
		if name == "fetch:"+testPlanDigest {
			fetches++
		}
	}
	if fetches != transientFailures+1 {
		t.Fatalf("plan was read %d times, want %d", fetches, transientFailures+1)
	}
}

func TestRefreshUntilAcceptedFailsFastOnPermanentRejection(t *testing.T) {
	t.Parallel()
	scripted := newScriptedPlanControl()
	scripted.fetchErr = &apierror.Error{
		Operation:  "fetch Machine tunnel plan",
		StatusCode: http.StatusUnauthorized,
		Cause:      errTransientControl,
	}
	manager := managerWithPlan(scripted)
	ctx, cancel := context.WithTimeout(context.Background(), testStartupRetryDeadline)
	defer cancel()

	if err := manager.refreshUntilAccepted(ctx, ctx); !permanentControlError(err) {
		t.Fatalf("refreshUntilAccepted returned %v, want the permanent rejection", err)
	}
}
