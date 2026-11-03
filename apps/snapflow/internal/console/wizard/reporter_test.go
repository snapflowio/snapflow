// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type scriptedSetup struct{}

func (scriptedSetup) Phases() []admin.SetupPhase { return admin.SetupPhases(config.Production) }

func (scriptedSetup) Run(ctx context.Context, interaction admin.SetupInteraction) (admin.SetupResult, error) {
	result := admin.SetupResult{Profile: testProfile, DashboardURL: testDashboard, Payouts: apiclient.PayoutReadinessReady, Completed: []admin.SetupPhase{}}
	phases := admin.SetupPhases(config.Production)
	for index, phase := range phases {
		progress := admin.SetupProgress{Phase: phase, Step: index + 1, Total: len(phases)}
		interaction.PhaseStarted(progress)
		switch phase {
		case admin.SetupPhasePreflight:
			interaction.CheckCompleted(doctor.DiagnosticCheck{Name: doctor.CheckKVM, Status: doctor.CheckPassed, Required: true, Detail: "ok"})
		case admin.SetupPhaseRelease:
			progress.Note = admin.SetupNoteReleaseVerified
		case admin.SetupPhaseAuthorization:
			interaction.AuthorizationStarted(testCode())
			if organization, err := interaction.ChooseOrganization(ctx, testOrganizationChoice()); err != nil {
				return result, err
			} else if organization != testPersonalOrganization() {
				return result, errors.New("the reporter did not keep the active organization")
			}
			result.MachineID = testMachineID
		}
		interaction.PhaseFinished(progress)
		result.Completed = append(result.Completed, phase)
	}
	result.Ready = true
	return result, nil
}

func reportConsole(t *testing.T, out, stderr *bytes.Buffer) *cli.Console {
	t.Helper()
	console, err := cli.NewConsole(cli.ConsoleConfig{In: strings.NewReader(""), Out: out, Err: stderr})
	if err != nil {
		t.Fatal(err)
	}
	return console
}

func TestReportPrintsOneLinePerEvent(t *testing.T) {
	var out, stderr bytes.Buffer
	err := Report(context.Background(), Config{
		Setup: scriptedSetup{}, Console: reportConsole(t, &out, &stderr), Profile: testProfile,
		Lookup: func(string) string { return "" },
	})
	if err != nil {
		t.Fatal(err)
	}
	assertContains(
		t, out.String(),
		"[1/6] "+text.PhaseInspection,
		"✓ KVM virtualization",
		"✓ "+text.NoteReleaseVerified,
		text.ApprovalLine(testApprovalURL, testUserCode),
		text.OrganizationsTitle, "Garage (garage) · active", "Acme Compute (acme)",
		text.RegistersInto("Garage (garage)"), text.OrganizationPickHint,
		text.DoneTitle, testMachineID,
	)
	if strings.Contains(out.String(), "\x1b[") {
		t.Fatal("report output to a non-terminal contains escape sequences")
	}
}

func TestReportWritesJSONResult(t *testing.T) {
	var out, stderr, result bytes.Buffer
	err := Report(context.Background(), Config{
		Setup: scriptedSetup{}, Console: reportConsole(t, &out, &stderr), Profile: testProfile,
		Lookup: func(string) string { return "" }, ResultJSON: &result,
	})
	if err != nil {
		t.Fatal(err)
	}
	decoded := admin.SetupResult{}
	if err := json.Unmarshal(result.Bytes(), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.MachineID != testMachineID || !decoded.Ready {
		t.Fatalf("JSON result = %+v", decoded)
	}
}
