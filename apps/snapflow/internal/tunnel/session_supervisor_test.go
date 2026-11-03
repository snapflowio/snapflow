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
	"fmt"
	"log/slog"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	testRenewalDelay  = 20 * time.Millisecond
	testDrainTimeout  = time.Second
	testEventDeadline = 5 * time.Second
)

type supervisorEvents struct {
	mu     sync.Mutex
	events []string
	signal chan struct{}
}

func newSupervisorEvents() *supervisorEvents {
	return &supervisorEvents{signal: make(chan struct{}, 64)}
}

func (log *supervisorEvents) add(event string) {
	log.mu.Lock()
	log.events = append(log.events, event)
	log.mu.Unlock()
	log.signal <- struct{}{}
}

func (log *supervisorEvents) snapshot() []string {
	log.mu.Lock()
	defer log.mu.Unlock()
	return slices.Clone(log.events)
}

func (log *supervisorEvents) waitFor(t *testing.T, event string) {
	t.Helper()
	deadline := time.After(testEventDeadline)
	for !slices.Contains(log.snapshot(), event) {
		select {
		case <-log.signal:
		case <-deadline:
			t.Fatalf("event %q did not occur; events: %v", event, log.snapshot())
		}
	}
}

type fakeServingSession struct {
	name      string
	renewAt   time.Time
	failedCh  chan struct{}
	failErr   error
	events    *supervisorEvents
	closeOnce sync.Once
}

func (session *fakeServingSession) renewalDue() time.Time { return session.renewAt }

func (session *fakeServingSession) failed() <-chan struct{} { return session.failedCh }

func (session *fakeServingSession) failure() error { return session.failErr }

func (session *fakeServingSession) drain(ctx context.Context, timeout time.Duration) {
	if timeout <= 0 || timeout > testDrainTimeout {
		session.events.add(fmt.Sprintf("bad-drain-timeout:%s", session.name))
	}
	session.events.add("drain:" + session.name)
	session.close()
}

func (session *fakeServingSession) close() {
	session.closeOnce.Do(func() { session.events.add("close:" + session.name) })
}

type scriptedEstablisher struct {
	events  *supervisorEvents
	results []func() (servingSession, error)
	mu      sync.Mutex
}

func (establisher *scriptedEstablisher) establish(ctx context.Context) (servingSession, error) {
	establisher.mu.Lock()
	defer establisher.mu.Unlock()
	if len(establisher.results) == 0 {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	next := establisher.results[0]
	establisher.results = establisher.results[1:]
	return next()
}

func (establisher *scriptedEstablisher) session(name string, renewIn time.Duration) func() (servingSession, error) {
	return func() (servingSession, error) {
		establisher.events.add("establish:" + name)
		return &fakeServingSession{
			name:     name,
			renewAt:  time.Now().Add(renewIn),
			failedCh: make(chan struct{}),
			events:   establisher.events,
		}, nil
	}
}

func (establisher *scriptedEstablisher) failure(name string) func() (servingSession, error) {
	return func() (servingSession, error) {
		establisher.events.add("establish-failed:" + name)
		return nil, errors.New("certificate issuance failed")
	}
}

func runTestSupervisor(establisher *scriptedEstablisher) (context.CancelFunc, <-chan struct{}) {
	ctx, cancel := context.WithCancel(context.Background())
	supervisor := sessionSupervisor{
		establish:    establisher.establish,
		ready:        func() {},
		log:          slog.New(slog.DiscardHandler),
		backoff:      reconnect.Backoff{Minimum: time.Millisecond, Maximum: 5 * time.Millisecond, Factor: 2},
		drainTimeout: testDrainTimeout,
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		supervisor.run(ctx)
	}()
	return cancel, done
}

func TestCertificateRenewalEstablishesReplacementBeforeDraining(t *testing.T) {
	events := newSupervisorEvents()
	establisher := &scriptedEstablisher{events: events}
	establisher.results = []func() (servingSession, error){
		establisher.session("first", testRenewalDelay),
		establisher.session("second", time.Hour),
	}
	cancel, done := runTestSupervisor(establisher)
	events.waitFor(t, "close:first")
	cancel()
	<-done
	recorded := events.snapshot()
	want := []string{"establish:first", "establish:second", "drain:first", "close:first", "close:second"}
	if !slices.Equal(recorded, want) {
		t.Fatalf("events = %v, want %v", recorded, want)
	}
}

func TestFailedRenewalKeepsTheServingSession(t *testing.T) {
	events := newSupervisorEvents()
	establisher := &scriptedEstablisher{events: events}
	establisher.results = []func() (servingSession, error){
		establisher.session("first", testRenewalDelay),
		establisher.failure("renewal"),
		establisher.session("second", time.Hour),
	}
	cancel, done := runTestSupervisor(establisher)
	events.waitFor(t, "close:first")
	cancel()
	<-done
	recorded := events.snapshot()
	want := []string{
		"establish:first", "establish-failed:renewal", "establish:second",
		"drain:first", "close:first", "close:second",
	}
	if !slices.Equal(recorded, want) {
		t.Fatalf("events = %v, want %v", recorded, want)
	}
}

func TestFailedSessionIsClosedAndReplaced(t *testing.T) {
	events := newSupervisorEvents()
	establisher := &scriptedEstablisher{events: events}
	var failing *fakeServingSession
	establisher.results = []func() (servingSession, error){
		func() (servingSession, error) {
			events.add("establish:first")
			failing = &fakeServingSession{
				name: "first", renewAt: time.Now().Add(time.Hour),
				failedCh: make(chan struct{}), failErr: errors.New("carrier lost"), events: events,
			}
			close(failing.failedCh)
			return failing, nil
		},
		establisher.session("second", time.Hour),
	}
	cancel, done := runTestSupervisor(establisher)
	events.waitFor(t, "establish:second")
	cancel()
	<-done
	recorded := events.snapshot()
	want := []string{"establish:first", "close:first", "establish:second", "close:second"}
	if !slices.Equal(recorded, want) {
		t.Fatalf("events = %v, want %v", recorded, want)
	}
}
