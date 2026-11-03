// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	testSandboxID     = "7b0c6f63-3c71-4b6e-9a0d-2f4f6d1c8e01"
	otherSandboxID    = "0f2d8c4a-5b6e-4f7a-8b9c-1d2e3f4a5b6c"
	testIdentity      = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
	testDaemonVersion = "1.4.2"
	testSecretName    = "API_TOKEN"
	testSecretValue   = "secret-value"
	testImage         = "registry.example.com/snapflow/base:1.0"
	testUser          = "c0ffee00-0000-4000-8000-000000000001"
	testDocumentLife  = time.Hour
	staleErrorStatus  = http.StatusConflict
)

type fakeRuntime struct {
	mu         sync.Mutex
	runtimes   map[string]microvmtypes.RuntimeObservation
	operations []string
	secrets    []map[string]string
	failWith   error
}

func newFakeRuntime() *fakeRuntime {
	return &fakeRuntime{runtimes: make(map[string]microvmtypes.RuntimeObservation)}
}

func (runtime *fakeRuntime) host(sandboxID string, generation int, current microvmtypes.RuntimeState) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.runtimes[sandboxID] = microvmtypes.RuntimeObservation{
		ID: sandboxID, Identity: microvmtypes.RuntimeArtifactIdentity{AssignmentGeneration: generation},
		Info: hostedInfo(current), ControlPlaneManaged: true, InspectionComplete: true,
	}
}

func hostedInfo(current microvmtypes.RuntimeState) microvmtypes.RuntimeInfo {
	resources := testSpec().GetResources()
	return microvmtypes.RuntimeInfo{
		State: current, CPUVCPUs: int64(resources.GetCpuQuota()),
		MemoryGiB: int64(resources.GetMemoryQuota()), StorageGiB: int64(resources.GetStorageQuota()),
	}
}

func (runtime *fakeRuntime) resize(sandboxID string, resources *machinev1alpha1.SandboxResources) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	observation, found := runtime.runtimes[sandboxID]
	if !found {
		return
	}
	observation.Info.CPUVCPUs = int64(resources.GetCpuQuota())
	observation.Info.MemoryGiB = int64(resources.GetMemoryQuota())
	observation.Info.StorageGiB = int64(resources.GetStorageQuota())
	runtime.runtimes[sandboxID] = observation
}

func (runtime *fakeRuntime) cpu(sandboxID string) int64 {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	return runtime.runtimes[sandboxID].Info.CPUVCPUs
}

func (runtime *fakeRuntime) lose(sandboxID string) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	delete(runtime.runtimes, sandboxID)
}

func (runtime *fakeRuntime) recorded() []string {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	return append([]string(nil), runtime.operations...)
}

func (runtime *fakeRuntime) state(sandboxID string) (microvmtypes.RuntimeState, bool) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	observation, found := runtime.runtimes[sandboxID]
	return observation.Info.State, found
}

func (runtime *fakeRuntime) transition(operation, sandboxID string, next microvmtypes.RuntimeState) error {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.operations = append(runtime.operations, operation)
	if runtime.failWith != nil {
		return runtime.failWith
	}
	observation, found := runtime.runtimes[sandboxID]
	if !found {
		return nil
	}
	observation.Info.State = next
	runtime.runtimes[sandboxID] = observation
	return nil
}

func (runtime *fakeRuntime) RuntimeInventory(ctx context.Context) ([]microvmtypes.RuntimeObservation, error) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	return append([]microvmtypes.RuntimeObservation(nil), mapsValues(runtime.runtimes)...), ctx.Err()
}

func (runtime *fakeRuntime) Materialize(ctx context.Context, request sandboxruntime.MaterializeRequest) (sandboxruntime.StartResult, error) {
	runtime.mu.Lock()
	runtime.secrets = append(runtime.secrets, request.Secrets.GetEnv())
	runtime.mu.Unlock()
	next := microvmtypes.RuntimeStateStopped
	if request.Start {
		next = microvmtypes.RuntimeStateStarted
	}
	if err := runtime.transition(operationMaterialize, request.Assignment.SandboxID, next); err != nil {
		return sandboxruntime.StartResult{}, err
	}
	runtime.host(request.Assignment.SandboxID, int(request.Assignment.Generation), next)
	return startResult(request.Start), ctx.Err()
}

func (runtime *fakeRuntime) Adopt(ctx context.Context, assignment sandboxruntime.Assignment) error {
	runtime.mu.Lock()
	observation := runtime.runtimes[assignment.SandboxID]
	runtime.mu.Unlock()
	if observation.Identity.AssignmentGeneration > int(assignment.Generation) {
		return staleAssignmentError{}
	}
	return runtime.transition(operationAdopt, assignment.SandboxID, observation.Info.State)
}

func (runtime *fakeRuntime) Start(ctx context.Context, assignment sandboxruntime.Assignment, secretEnv map[string]string) (sandboxruntime.StartResult, error) {
	runtime.mu.Lock()
	runtime.secrets = append(runtime.secrets, secretEnv)
	runtime.mu.Unlock()
	return startResult(true), runtime.transition(operationStart, assignment.SandboxID, microvmtypes.RuntimeStateStarted)
}

func (runtime *fakeRuntime) Resume(ctx context.Context, assignment sandboxruntime.Assignment) (sandboxruntime.StartResult, error) {
	return startResult(true), runtime.transition(operationResume, assignment.SandboxID, microvmtypes.RuntimeStateStarted)
}

func (runtime *fakeRuntime) Stop(ctx context.Context, assignment sandboxruntime.Assignment, force bool) error {
	operation := operationStop
	if force {
		operation += forcedSuffix
	}
	return runtime.transition(operation, assignment.SandboxID, microvmtypes.RuntimeStateStopped)
}

func (runtime *fakeRuntime) Pause(ctx context.Context, assignment sandboxruntime.Assignment) error {
	return runtime.transition(operationPause, assignment.SandboxID, microvmtypes.RuntimeStateStandby)
}

func (runtime *fakeRuntime) Resize(ctx context.Context, assignment sandboxruntime.Assignment, resources *machinev1alpha1.SandboxResources) error {
	current, found := runtime.state(assignment.SandboxID)
	if !found {
		current = microvmtypes.RuntimeStateStopped
	}
	if err := runtime.transition(operationResize, assignment.SandboxID, current); err != nil {
		return err
	}
	runtime.resize(assignment.SandboxID, resources)
	return nil
}

func (runtime *fakeRuntime) UpdateNetwork(ctx context.Context, assignment sandboxruntime.Assignment, policy *machinev1alpha1.NetworkPolicy) error {
	current, found := runtime.state(assignment.SandboxID)
	if !found {
		current = microvmtypes.RuntimeStateStopped
	}
	return runtime.transition(operationNetwork, assignment.SandboxID, current)
}

func (runtime *fakeRuntime) Recover(ctx context.Context, assignment sandboxruntime.Assignment, recovery *machinev1alpha1.SandboxRecovery, spec *machinev1alpha1.SandboxSpec) error {
	return runtime.transition(operationRecover, assignment.SandboxID, microvmtypes.RuntimeStateStopped)
}

func (runtime *fakeRuntime) DaemonVersion(ctx context.Context, sandboxID string) (string, error) {
	current, found := runtime.state(sandboxID)
	if err := runtime.transition(operationReady, sandboxID, current); err != nil || !found {
		return "", err
	}
	return testDaemonVersion, nil
}

func (runtime *fakeRuntime) Destroy(ctx context.Context, sandboxID string) error {
	if err := runtime.transition(operationDestroy, sandboxID, microvmtypes.RuntimeStateDestroyed); err != nil {
		return err
	}
	runtime.lose(sandboxID)
	return ctx.Err()
}

const forcedSuffix = "-forced"

func startResult(started bool) sandboxruntime.StartResult {
	if !started {
		return sandboxruntime.StartResult{}
	}
	return sandboxruntime.StartResult{DaemonVersion: testDaemonVersion}
}

type staleAssignmentError struct{}

func (staleAssignmentError) Error() string     { return "assignment generation is stale" }
func (staleAssignmentError) ErrorCode() string { return sandboxruntime.StaleAssignmentErrorCode }

func mapsValues[K comparable, V any](values map[K]V) []V {
	result := make([]V, 0, len(values))
	for value := range maps.Values(values) {
		result = append(result, value)
	}
	return result
}

type fakeControl struct {
	mu          sync.Mutex
	documents   []*apiclient.MachineDesiredStateDocumentDto
	fetchErr    error
	digests     []string
	secretsErr  error
	reports     []*machinev1alpha1.SandboxObservedStatusReport
	verdicts    map[string]machinev1alpha1.SandboxObservedStatusVerdict
	reportedEnv []map[string]string
}

func (control *fakeControl) FetchDesiredState(ctx context.Context, digest string) (*apiclient.MachineDesiredStateDocumentDto, bool, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	control.digests = append(control.digests, digest)
	if control.fetchErr != nil {
		return nil, false, control.fetchErr
	}
	if len(control.documents) == 0 {
		return nil, false, ctx.Err()
	}
	next := control.documents[0]
	control.documents = control.documents[1:]
	return next, true, ctx.Err()
}

func (control *fakeControl) Secrets(ctx context.Context, assignment sandboxruntime.Assignment, specGeneration uint32) (*machinev1alpha1.SandboxSecrets, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.secretsErr != nil {
		return nil, control.secretsErr
	}
	secrets := &machinev1alpha1.SandboxSecrets{
		SandboxId: assignment.SandboxID, AssignmentGeneration: assignment.Generation, SpecGeneration: specGeneration,
		Env: map[string]string{testSecretName: testSecretValue},
	}
	control.reportedEnv = append(control.reportedEnv, secrets.Env)
	return secrets, ctx.Err()
}

func (control *fakeControl) ReportStatus(ctx context.Context, report *machinev1alpha1.SandboxObservedStatusReport) (*machinev1alpha1.SandboxObservedStatusReportResult, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	control.reports = append(control.reports, report)
	result := &machinev1alpha1.SandboxObservedStatusReportResult{}
	for _, status := range report.GetStatuses() {
		verdict, found := control.verdicts[status.GetSandboxId()]
		if !found {
			verdict = machinev1alpha1.SandboxObservedStatusVerdict_SANDBOX_OBSERVED_STATUS_VERDICT_ACCEPTED
		}
		result.Acknowledgements = append(result.Acknowledgements, &machinev1alpha1.SandboxObservedStatusAcknowledgement{
			SandboxId: status.GetSandboxId(), Verdict: verdict,
		})
	}
	return result, ctx.Err()
}

func (control *fakeControl) latestReport() *machinev1alpha1.SandboxObservedStatusReport {
	control.mu.Lock()
	defer control.mu.Unlock()
	if len(control.reports) == 0 {
		return nil
	}
	return control.reports[len(control.reports)-1]
}

type memoryRecords struct {
	mu      sync.Mutex
	records map[string]state.SandboxConvergence
}

func newMemoryRecords() *memoryRecords {
	return &memoryRecords{records: make(map[string]state.SandboxConvergence)}
}

func (store *memoryRecords) LoadSandboxConvergences(ctx context.Context) ([]state.SandboxConvergence, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	return mapsValues(store.records), ctx.Err()
}

func (store *memoryRecords) SaveSandboxConvergence(ctx context.Context, record state.SandboxConvergence) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.records[record.SandboxID] = record
	return ctx.Err()
}

func (store *memoryRecords) DeleteSandboxConvergence(ctx context.Context, sandboxID string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	delete(store.records, sandboxID)
	return ctx.Err()
}

func testManager(t *testing.T, runtime *fakeRuntime, control *fakeControl, store *memoryRecords) *Manager {
	t.Helper()
	service, err := NewManager(
		ManagerConfig{ReportInterval: time.Hour, RequestTimeout: time.Second},
		ManagerDependencies{
			Control: control, Converger: testConverger(t, runtime, control), Runtime: runtime, Records: store,
			LocalRuntimes: NewLocalRuntimes(), Snapshots: &fakeSnapshots{}, Meter: fakeMeter{runtime: runtime},
		},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("newService() error = %v", err)
	}
	if err := service.records.load(t.Context()); err != nil {
		t.Fatalf("load records: %v", err)
	}
	return service
}

func testSpec() *machinev1alpha1.SandboxSpec {
	return &machinev1alpha1.SandboxSpec{
		Mode: string(workload.SandboxModeStandard), UserId: testUser, OsUser: "snapflow",
		Resources: &machinev1alpha1.SandboxResources{CpuQuota: 2, MemoryQuota: 4, StorageQuota: 10},
		Source:    &machinev1alpha1.SandboxSpec_Image{Image: &machinev1alpha1.SandboxImage{Ref: testImage}},
	}
}

func desiredSandbox(t *testing.T, sandboxID string, assignment, spec uint32, lifecycle machinev1alpha1.SandboxLifecycle) *machinev1alpha1.SandboxDesiredState {
	t.Helper()
	specification := testSpec()
	digest, err := workload.ProtoJSONDigest(specification)
	if err != nil {
		t.Fatalf("digest spec: %v", err)
	}
	return &machinev1alpha1.SandboxDesiredState{
		SandboxId: sandboxID, AssignmentGeneration: assignment, SpecGeneration: spec,
		Lifecycle: lifecycle, Spec: specification, SpecDigest: digest,
	}
}

func signedDocument(t *testing.T, revision uint64, expiresAt time.Time, sandboxes ...*machinev1alpha1.SandboxDesiredState) *apiclient.MachineDesiredStateDocumentDto {
	t.Helper()
	document := &machinev1alpha1.MachineDesiredState{
		Revision: revision, GeneratedAt: timestamppb.New(expiresAt.Add(-testDocumentLife)),
		ExpiresAt: timestamppb.New(expiresAt), Sandboxes: sandboxes,
	}
	digest, err := workload.ProtoJSONDigest(document)
	if err != nil {
		t.Fatalf("digest document: %v", err)
	}
	document.Digest = digest
	encoded, err := protojson.Marshal(document)
	if err != nil {
		t.Fatalf("encode document: %v", err)
	}
	return &apiclient.MachineDesiredStateDocumentDto{Digest: digest, Document: string(encoded)}
}

const (
	acceptedRevision      = 2
	transientWatchWindow  = 3 * time.Second
	maximumTransientReads = 6
)

const (
	operationMeter  = "meter"
	operationSample = "sample"
)

type fakeMeter struct {
	runtime *fakeRuntime
}

func (meter fakeMeter) Flush(ctx context.Context, assignment sandboxruntime.Assignment) {
	meter.runtime.mu.Lock()
	defer meter.runtime.mu.Unlock()
	if ctx.Err() == nil && assignment.Generation > 0 {
		meter.runtime.operations = append(meter.runtime.operations, operationMeter)
	}
}

func (meter fakeMeter) Sample(assignment sandboxruntime.Assignment) {
	meter.runtime.mu.Lock()
	defer meter.runtime.mu.Unlock()
	if assignment.Generation > 0 {
		meter.runtime.operations = append(meter.runtime.operations, operationSample)
	}
}

func testMetrics(t *testing.T) *Metrics {
	t.Helper()
	metrics, err := NewMetrics(prometheus.NewRegistry())
	if err != nil {
		t.Fatalf("NewMetrics() error = %v", err)
	}
	return metrics
}
