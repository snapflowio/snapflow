// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli/clitest"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func completed(notes map[admin.SetupPhase]admin.SetupNote, phases ...admin.SetupPhase) []tea.Msg {
	messages := []tea.Msg{}
	for index, phase := range phases {
		progress := admin.SetupProgress{Phase: phase, Step: index + 1, Total: testStepTotal}
		messages = append(messages, phaseStartedMsg(progress))
		progress.Note = notes[phase]
		messages = append(messages, phaseFinishedMsg(progress))
	}
	return messages
}

func passedChecks() []tea.Msg {
	return []tea.Msg{
		checkMsg(doctor.DiagnosticCheck{Name: doctor.CheckKVM, Status: doctor.CheckPassed, Required: true, Detail: "/dev/kvm is readable and writable"}),
		checkMsg(doctor.DiagnosticCheck{Name: doctor.CheckNetworkPolicy, Status: doctor.CheckPassed, Required: true, Detail: "nftables is available for sandbox network isolation"}),
		checkMsg(doctor.DiagnosticCheck{Name: doctor.CheckStorage, Status: doctor.CheckPassed, Required: true, Detail: "412.3 GiB free on /var/lib"}),
	}
}

func TestScreenApproval(t *testing.T) {
	current := apply(t, newTestModel(), passedChecks()...)
	current = apply(t, current, completed(map[admin.SetupPhase]admin.SetupNote{
		admin.SetupPhaseRelease: admin.SetupNoteReleaseVerified,
	}, admin.SetupPhaseInspection, admin.SetupPhasePreflight, admin.SetupPhaseRelease)...)
	authorization := admin.SetupProgress{Phase: admin.SetupPhaseAuthorization, Step: 4, Total: testStepTotal}
	current = apply(t, current, phaseStartedMsg(authorization), approvalMsg(testCode()), browserMsg{})
	clitest.Assert(t, "screen_approval", current.View().Content)
}

func TestScreenDone(t *testing.T) {
	current := apply(t, newTestModel(), completed(map[admin.SetupPhase]admin.SetupNote{
		admin.SetupPhaseRelease: admin.SetupNoteReleaseVerified,
	}, admin.SetupPhases(config.Production)...)...)
	current, command := update(t, current, setupDoneMsg{result: admin.SetupResult{
		Payouts:   apiclient.PayoutReadinessNotSetUp,
		Location:  &apiclient.Location{Country: "DE", Continent: apiclient.ContinentEurope},
		MachineID: testMachineID, DashboardURL: testDashboard, Ready: true,
	}})
	if !isQuit(command) {
		t.Fatal("the wizard did not quit after setup completed")
	}
	clitest.Assert(t, "screen_done", current.View().Content)
}

func TestScreenHostNotReady(t *testing.T) {
	current := apply(t, newTestModel(), completed(nil, admin.SetupPhaseInspection)...)
	preflight := admin.SetupProgress{Phase: admin.SetupPhasePreflight, Step: 2, Total: testStepTotal}
	current = apply(
		t, current, phaseStartedMsg(preflight),
		checkMsg(doctor.DiagnosticCheck{
			Name: doctor.CheckKVM, Status: doctor.CheckFailed, Required: true,
			Detail:      "access /dev/kvm: no such file or directory",
			Remediation: "enable hardware virtualization (Intel VT-x or AMD-V) in the firmware and load KVM",
		}),
		checkMsg(doctor.DiagnosticCheck{
			Name: doctor.CheckIPv4Forwarding, Status: doctor.CheckPassed, Required: true,
			Detail: "net.ipv4.ip_forward=1 lets sandbox traffic reach the uplink",
		}),
	)
	current, command := update(t, current, setupDoneMsg{err: admin.ErrHostNotReady})
	if !isQuit(command) {
		t.Fatal("the wizard did not quit after setup failed")
	}
	clitest.Assert(t, "screen_host_not_ready", current.View().Content)
}
