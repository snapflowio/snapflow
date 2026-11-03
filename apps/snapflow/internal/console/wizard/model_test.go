// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"bytes"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/control"
)

const (
	testProfile     = "production"
	testMachineID   = "f2a749e8-7f31-4ad3-8e12-8de345be5e3b"
	testUserCode    = "XKHM-R59E"
	testDeviceCode  = "device-secret"
	testDashboard   = "https://snapflow.io/dashboard/machines"
	testApprovalURL = testDashboard + "?code=" + testUserCode
	testExpiresIn   = 600
	testInterval    = 5
	testStepTotal   = 6
)

func testNow() time.Time {
	return time.Date(2026, time.October, 4, 12, 0, 0, 0, time.UTC)
}

func testCode() control.DeviceAuthorization {
	return control.DeviceAuthorization{
		DeviceCode: testDeviceCode, UserCode: testUserCode, VerificationURI: testDashboard,
		VerificationURIComplete: testApprovalURL, ExpiresIn: testExpiresIn, Interval: testInterval,
	}
}

func newTestModel() model {
	return newModel(modelConfig{
		theme: style.New(true), profile: testProfile, phases: admin.SetupPhases(config.Production),
		openBrowser: func(string) tea.Cmd { return nil },
		now:         func() time.Time { return testNow() },
	})
}

func update(t *testing.T, current model, message tea.Msg) (model, tea.Cmd) {
	t.Helper()
	updated, command := current.Update(message)
	next, isModel := updated.(model)
	if !isModel {
		t.Fatalf("Update returned %T", updated)
	}
	return next, command
}

func apply(t *testing.T, current model, messages ...tea.Msg) model {
	t.Helper()
	for _, message := range messages {
		next, command := update(t, current, message)
		if command != nil {
			t.Fatalf("%T produced an unexpected command", message)
		}
		current = next
	}
	return current
}

func plain(t *testing.T, rendered string) string {
	t.Helper()
	var buffer bytes.Buffer
	if written, err := style.PlainWriter(&buffer).WriteString(rendered); err != nil {
		t.Fatalf("strip styles after %d bytes: %v", written, err)
	}
	return buffer.String()
}

func screen(t *testing.T, current model) string {
	t.Helper()
	return plain(t, current.View().Content)
}

func assertContains(t *testing.T, view string, wants ...string) {
	t.Helper()
	for _, want := range wants {
		if !strings.Contains(view, want) {
			t.Errorf("view does not contain %q:\n%s", want, view)
		}
	}
}

func isQuit(command tea.Cmd) bool {
	if command == nil {
		return false
	}
	switch command().(type) {
	case tea.QuitMsg:
		return true
	default:
		return false
	}
}

func TestModelTracksPhasesAndChecks(t *testing.T) {
	progress := admin.SetupProgress{Phase: admin.SetupPhasePreflight, Step: 2, Total: testStepTotal}
	current := apply(
		t, newTestModel(),
		phaseStartedMsg(progress),
		checkMsg(doctor.DiagnosticCheck{Name: doctor.CheckKVM, Status: doctor.CheckPassed, Required: true, Detail: "/dev/kvm is readable and writable"}),
		phaseFinishedMsg(progress),
	)
	assertContains(t, screen(t, current), "✓ "+text.PhasePreflight, "✓ KVM virtualization", "○ "+text.PhaseRelease, text.QuitHint)
}

func TestModelShowsNotesForSkippedPhases(t *testing.T) {
	progress := admin.SetupProgress{Phase: admin.SetupPhaseAuthorization, Step: 4, Total: testStepTotal, Note: admin.SetupNoteAlreadyApproved}
	current := apply(t, newTestModel(), phaseStartedMsg(progress), phaseFinishedMsg(progress))
	assertContains(t, screen(t, current), text.PhaseAuthorization+" · "+text.NoteAlreadyApproved)
}

func TestModelFailureShowsFixesAndQuits(t *testing.T) {
	progress := admin.SetupProgress{Phase: admin.SetupPhasePreflight, Step: 2, Total: testStepTotal}
	current := apply(t, newTestModel(), phaseStartedMsg(progress), checkMsg(doctor.DiagnosticCheck{
		Name: doctor.CheckKVM, Status: doctor.CheckFailed, Required: true, Detail: "no such file", Remediation: "enable VT-x",
	}))
	current, command := update(t, current, setupDoneMsg{err: admin.ErrHostNotReady})
	if current.stage != stageFailed || !isQuit(command) {
		t.Fatalf("stage = %d, quit = %t; want a failed stage that quits", current.stage, isQuit(command))
	}
	assertContains(t, screen(t, current), "✗ "+text.PhasePreflight, "✗ KVM virtualization", "→ enable VT-x",
		text.SetupFailed(admin.ErrHostNotReady.Error()), text.FailedFixPrefix+" "+text.CommandSetup)
	if code := cli.ExitCode(current.outcome()); code != cli.ExitConfigurationError {
		t.Fatalf("exit code = %d, want %d", code, cli.ExitConfigurationError)
	}
}

func TestModelApprovalShowsCodeLinkAndQR(t *testing.T) {
	progress := admin.SetupProgress{Phase: admin.SetupPhaseAuthorization, Step: 4, Total: testStepTotal}
	current := apply(t, newTestModel(), phaseStartedMsg(progress), approvalMsg(testCode()), browserMsg{})
	view := screen(t, current)
	assertContains(t, view, text.ApprovalTitle, testApprovalURL, testUserCode, "█", text.ExpiresIn("10m0s"), text.ApprovalBrowser)
	if strings.Contains(view, testDeviceCode) {
		t.Fatal("the approval panel shows the device code polling secret")
	}
}

func TestModelCompletesWithSummary(t *testing.T) {
	current, command := update(t, newTestModel(), setupDoneMsg{result: admin.SetupResult{
		MachineID: testMachineID, DashboardURL: testDashboard, Ready: true,
	}})
	if current.stage != stageDone || !isQuit(command) {
		t.Fatalf("stage = %d, want done", current.stage)
	}
	assertContains(t, screen(t, current), text.DoneTitle, testMachineID, testDashboard, text.CommandStatusWatch,
		text.MarketplaceManagedInDashboard)
	if err := current.outcome(); err != nil {
		t.Fatalf("outcome() = %v", err)
	}
}

func TestModelCancelsOnInterrupt(t *testing.T) {
	current, command := update(t, newTestModel(), tea.KeyPressMsg{Code: 'c', Mod: tea.ModCtrl})
	if current.stage != stageCancelled || !isQuit(command) {
		t.Fatalf("stage = %d, want cancelled", current.stage)
	}
	if code := cli.ExitCode(current.outcome()); code != cli.ExitInterrupted {
		t.Fatalf("exit code = %d, want %d", code, cli.ExitInterrupted)
	}
}
