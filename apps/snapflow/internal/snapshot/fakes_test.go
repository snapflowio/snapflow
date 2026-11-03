// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/reconnect"
	"google.golang.org/protobuf/proto"
)

const (
	testDigest         = "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
	otherDigest        = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
	testSizeBytes      = 1 << 20
	testTemplateKey    = "template-key"
	testRegistryID     = "5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c"
	testRegistryURL    = "https://registry.example.com"
	testWaitTimeout    = 5 * time.Second
	testPollInterval   = 5 * time.Millisecond
	testLongInterval   = time.Hour
	testRequestTimeout = time.Second
	testGracePeriod    = 5 * time.Minute
	testHighThreshold  = 85
	testLowThreshold   = 80
	testBackoffMinimum = 10 * time.Millisecond
	testBackoffMaximum = 20 * time.Millisecond
	pressureUsage      = 95
	relievedUsage      = 50
)

const (
	imageRemoval    = "image:"
	templateRemoval = "template:"
)

var errPullFailed = errors.New("registry unavailable")

type fakeRuntime struct {
	mu           sync.Mutex
	images       map[string]sandboxruntime.ImageInfo
	digests      map[string]string
	pulls        map[string]int
	registries   []*machinev1alpha1.Registry
	removed      []string
	removals     []string
	templates    []string
	preparations []*machinev1alpha1.TemplatePreparation
	inventory    []microvmtypes.RuntimeObservation
	failPulls    int
	blockPulls   chan struct{}
	pullStarted  chan string
}

func newFakeRuntime() *fakeRuntime {
	return &fakeRuntime{
		images: make(map[string]sandboxruntime.ImageInfo), digests: make(map[string]string),
		pulls: make(map[string]int), pullStarted: make(chan string, 1),
	}
}

func (runtime *fakeRuntime) hold(ref string) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.images[ref] = sandboxruntime.ImageInfo{Reference: ref, Digest: testDigest, SizeBytes: testSizeBytes}
}

func (runtime *fakeRuntime) PullImage(ctx context.Context, ref string, registry *machinev1alpha1.Registry) error {
	runtime.mu.Lock()
	runtime.pulls[ref]++
	runtime.registries = append(runtime.registries, proto.CloneOf(registry))
	block := runtime.blockPulls
	failing := runtime.failPulls > 0
	if failing {
		runtime.failPulls--
	}
	runtime.mu.Unlock()
	select {
	case runtime.pullStarted <- ref:
	default:
	}
	if block != nil {
		select {
		case <-block:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if failing {
		return errPullFailed
	}
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	digest := runtime.digests[ref]
	if digest == "" {
		digest = testDigest
	}
	runtime.images[ref] = sandboxruntime.ImageInfo{Reference: ref, Digest: digest, SizeBytes: testSizeBytes}
	return nil
}

func (runtime *fakeRuntime) ImageInfo(ctx context.Context, ref string) (sandboxruntime.ImageInfo, error) {
	if err := ctx.Err(); err != nil {
		return sandboxruntime.ImageInfo{}, err
	}
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	info, found := runtime.images[ref]
	if !found {
		return sandboxruntime.ImageInfo{}, os.ErrNotExist
	}
	return info, nil
}

func (runtime *fakeRuntime) RemoveImage(ctx context.Context, ref string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	delete(runtime.images, ref)
	runtime.removed = append(runtime.removed, ref)
	runtime.removals = append(runtime.removals, imageRemoval+ref)
	return nil
}

func (runtime *fakeRuntime) RemoveTemplate(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.removals = append(runtime.removals, templateRemoval+key)
	return nil
}

func (runtime *fakeRuntime) PrepareTemplate(ctx context.Context, ref string, preparation *machinev1alpha1.TemplatePreparation) (string, error) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.templates = append(runtime.templates, ref)
	runtime.preparations = append(runtime.preparations, proto.CloneOf(preparation))
	return testTemplateKey, ctx.Err()
}

func (runtime *fakeRuntime) RuntimeInventory(ctx context.Context) ([]microvmtypes.RuntimeObservation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	return append([]microvmtypes.RuntimeObservation(nil), runtime.inventory...), nil
}

func (runtime *fakeRuntime) pullCount(ref string) int {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	return runtime.pulls[ref]
}

func (runtime *fakeRuntime) heldBytes() int64 {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	total := int64(0)
	for _, info := range runtime.images {
		total += info.SizeBytes
	}
	return total
}

func (runtime *fakeRuntime) removedRefs() []string {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	return append([]string(nil), runtime.removed...)
}

type fakeRecords struct {
	mu      sync.Mutex
	records map[string]state.SnapshotRecord
}

func newFakeRecords() *fakeRecords {
	return &fakeRecords{records: make(map[string]state.SnapshotRecord)}
}

func (records *fakeRecords) LoadSnapshotRecords(ctx context.Context) ([]state.SnapshotRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	records.mu.Lock()
	defer records.mu.Unlock()
	loaded := make([]state.SnapshotRecord, 0, len(records.records))
	for _, record := range records.records {
		loaded = append(loaded, record)
	}
	return loaded, nil
}

func (records *fakeRecords) SaveSnapshotRecord(ctx context.Context, record state.SnapshotRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	records.mu.Lock()
	defer records.mu.Unlock()
	records.records[record.Ref] = record
	return nil
}

func (records *fakeRecords) DeleteSnapshotRecord(ctx context.Context, ref string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	records.mu.Lock()
	defer records.mu.Unlock()
	delete(records.records, ref)
	return nil
}

func (records *fakeRecords) has(ref string) bool {
	records.mu.Lock()
	defer records.mu.Unlock()
	return records.records[ref].Ref == ref
}

type fakeControl struct {
	mu      sync.Mutex
	reports []*machinev1alpha1.MachineSnapshotInventory
}

func (control *fakeControl) RegistryCredentials(ctx context.Context, registryID string) (*machinev1alpha1.Registry, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if registryID != testRegistryID {
		return nil, errors.New("unknown registry")
	}
	return &machinev1alpha1.Registry{Url: testRegistryURL, Username: proto.String("robot"), Password: proto.String("secret")}, nil
}

func (control *fakeControl) ReportInventory(ctx context.Context, inventory *machinev1alpha1.MachineSnapshotInventory) error {
	control.mu.Lock()
	defer control.mu.Unlock()
	control.reports = append(control.reports, proto.CloneOf(inventory))
	return ctx.Err()
}

func (control *fakeControl) everReported(ref string, inventoryState machinev1alpha1.SnapshotInventoryState) bool {
	control.mu.Lock()
	defer control.mu.Unlock()
	for _, report := range control.reports {
		for _, snapshot := range report.GetSnapshots() {
			if snapshot.GetRef() == ref && snapshot.GetState() == inventoryState {
				return true
			}
		}
	}
	return false
}

type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func (clock *fakeClock) Now() time.Time {
	clock.mu.Lock()
	defer clock.mu.Unlock()
	return clock.now
}

func (clock *fakeClock) advance(duration time.Duration) {
	clock.mu.Lock()
	defer clock.mu.Unlock()
	clock.now = clock.now.Add(duration)
}

type fakeDisk struct {
	mu            sync.Mutex
	usage         float64
	runtime       *fakeRuntime
	capacityBytes int64
}

func (disk *fakeDisk) Usage(ctx context.Context) (float64, error) {
	disk.mu.Lock()
	defer disk.mu.Unlock()
	if disk.capacityBytes > 0 {
		return float64(disk.runtime.heldBytes()) * maximumPercentage / float64(disk.capacityBytes), ctx.Err()
	}
	return disk.usage, ctx.Err()
}

func (disk *fakeDisk) measure(runtime *fakeRuntime, capacityBytes int64) {
	disk.mu.Lock()
	defer disk.mu.Unlock()
	disk.runtime, disk.capacityBytes = runtime, capacityBytes
}

type harness struct {
	store   *Store
	runtime *fakeRuntime
	records *fakeRecords
	control *fakeControl
	clock   *fakeClock
	disk    *fakeDisk
}

func newHarness(t *testing.T, runtime *fakeRuntime, records *fakeRecords) *harness {
	t.Helper()
	test := &harness{
		runtime: runtime, records: records, control: &fakeControl{},
		clock: &fakeClock{now: time.Unix(0, 0)}, disk: &fakeDisk{usage: relievedUsage},
	}
	store, err := NewStore(
		StoreConfig{
			Policy: GarbageCollectionPolicy{
				HighThresholdPercent: testHighThreshold, LowThresholdPercent: testLowThreshold,
				GracePeriod: testGracePeriod, Interval: testLongInterval,
			},
			ReportInterval: testLongInterval, RequestTimeout: testRequestTimeout,
		},
		StoreDependencies{Runtime: runtime, Records: records, Control: test.control, DiskUsage: test.disk.Usage},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
		WithClock(test.clock.Now),
		WithPullBackoff(reconnect.Backoff{Minimum: testBackoffMinimum, Maximum: testBackoffMaximum, Factor: pullBackoffFactor}),
	)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	test.store = store
	return test
}

func (test *harness) run(t *testing.T) (stop func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- test.store.Run(ctx) }()
	select {
	case <-test.store.started:
	case <-time.After(testWaitTimeout):
		t.Fatal("the store did not start")
	}
	var once sync.Once
	stop = func() {
		once.Do(func() {
			cancel()
			if err := <-done; err != nil {
				t.Errorf("run store: %v", err)
			}
		})
	}
	t.Cleanup(stop)
	return stop
}

func (test *harness) inventoryState(ref string) (machinev1alpha1.SnapshotInventoryState, *machinev1alpha1.ObservedSnapshot) {
	inventory, ready, err := test.store.Inventory()
	if err != nil || !ready {
		return machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_UNSPECIFIED, nil
	}
	for _, snapshot := range inventory.GetSnapshots() {
		if snapshot.GetRef() == ref {
			return snapshot.GetState(), snapshot
		}
	}
	return machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_UNSPECIFIED, nil
}

func eventually(t *testing.T, description string, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(testWaitTimeout)
	for !condition() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting until %s", description)
		}
		time.Sleep(testPollInterval)
	}
}

func registrySnapshot(ref string) *machinev1alpha1.DesiredSnapshot {
	return &machinev1alpha1.DesiredSnapshot{
		Ref: ref,
		Source: &machinev1alpha1.DesiredSnapshot_Registry{
			Registry: &machinev1alpha1.SnapshotRegistrySource{RegistryId: proto.String(testRegistryID)},
		},
		Retention: machinev1alpha1.SnapshotRetention_SNAPSHOT_RETENTION_REQUIRED,
	}
}

func prewarmSnapshot(ref string) *machinev1alpha1.DesiredSnapshot {
	desired := registrySnapshot(ref)
	desired.Retention = machinev1alpha1.SnapshotRetention_SNAPSHOT_RETENTION_PREWARM
	return desired
}

func holdRecorded(t *testing.T, runtime *fakeRuntime, records *fakeRecords, ref string) {
	t.Helper()
	runtime.hold(ref)
	if err := records.SaveSnapshotRecord(context.Background(), state.SnapshotRecord{Ref: ref, Digest: testDigest, SizeBytes: testSizeBytes}); err != nil {
		t.Fatal(err)
	}
}
