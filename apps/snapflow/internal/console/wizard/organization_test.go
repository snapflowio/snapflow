// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"context"
	"errors"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli/clitest"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/control"
)

func testTeamOrganization() control.Organization {
	return control.Organization{ID: "7b1d0c5e-2a4f-4e8b-9c36-1f5a8d2e6b40", Name: "Acme Compute", Slug: "acme"}
}

func testPersonalOrganization() control.Organization {
	return control.Organization{ID: "3f6c2a1e-9b7d-4c58-8e21-6a0d4b9f7c13", Name: "Garage", Slug: "garage"}
}

func testOrganizationChoice() control.OrganizationChoice {
	return control.OrganizationChoice{
		Organizations: []control.Organization{testPersonalOrganization(), testTeamOrganization()},
		Active:        testPersonalOrganization(),
	}
}

func choosingModel(t *testing.T, organizations chan control.Organization) model {
	t.Helper()
	initial := newTestModel()
	initial.cfg.organizations = organizations
	authorization := admin.SetupProgress{Phase: admin.SetupPhaseAuthorization, Step: 4, Total: testStepTotal}
	current := apply(t, initial, phaseStartedMsg(authorization), approvalMsg(testCode()), browserMsg{})
	current, command := update(t, current, organizationRequestMsg(testOrganizationChoice()))
	if current.stage != stageOrganization || command == nil {
		t.Fatalf("stage = %d, want the organization form with its init command", current.stage)
	}
	return current
}

func TestScreenOrganization(t *testing.T) {
	current := apply(t, newTestModel(), completed(nil,
		admin.SetupPhaseInspection, admin.SetupPhasePreflight, admin.SetupPhaseRelease)...)
	authorization := admin.SetupProgress{Phase: admin.SetupPhaseAuthorization, Step: 4, Total: testStepTotal}
	current = apply(t, current, phaseStartedMsg(authorization), approvalMsg(testCode()), browserMsg{})
	current, command := update(t, current, organizationRequestMsg(testOrganizationChoice()))
	if command == nil {
		t.Fatal("the organization form did not initialize")
	}
	clitest.Assert(t, "screen_organization", current.View().Content)
}

func TestModelOrganizationFormPreselectsTheActiveOrganization(t *testing.T) {
	current := choosingModel(t, nil)
	if current.choice.selected != testPersonalOrganization() {
		t.Fatalf("preselected = %+v, want the active organization", current.choice.selected)
	}
	assertContains(t, screen(t, current), text.OrganizationChooseTitle, "Garage (garage) · active", "Acme Compute (acme)")
}

func TestModelOrganizationFormDeliversTheChoice(t *testing.T) {
	organizations := make(chan control.Organization, 1)
	current := choosingModel(t, organizations)
	current.choice.selected = testTeamOrganization()
	current, command := update(t, current, organizationSubmittedMsg{})
	if current.stage != stageRunning || command == nil {
		t.Fatalf("stage = %d, want running with a delivery command", current.stage)
	}
	if message := command(); message != nil {
		t.Fatalf("delivery command returned %T", message)
	}
	if chosen := <-organizations; chosen != testTeamOrganization() {
		t.Fatalf("delivered = %+v, want %+v", chosen, testTeamOrganization())
	}
}

func TestModelOrganizationFormCancels(t *testing.T) {
	current, command := update(t, choosingModel(t, nil), organizationCancelledMsg{})
	if current.stage != stageCancelled || !isQuit(command) {
		t.Fatalf("stage = %d, want cancelled", current.stage)
	}
}

func TestBridgeWaitsForTheOrganizationChoice(t *testing.T) {
	organizations := make(chan control.Organization, 1)
	interaction := bridge{send: func(message tea.Msg) {
		if choice, isChoice := message.(organizationRequestMsg); isChoice {
			organizations <- choice.Organizations[1]
		}
	}, organizations: organizations}
	chosen, err := interaction.ChooseOrganization(context.Background(), testOrganizationChoice())
	if err != nil || chosen != testTeamOrganization() {
		t.Fatalf("ChooseOrganization() = %+v, %v", chosen, err)
	}
}

func TestBridgeOrganizationChoiceStopsOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	silent := bridge{send: func(tea.Msg) {}, organizations: make(chan control.Organization)}
	if chosen, err := silent.ChooseOrganization(ctx, testOrganizationChoice()); !errors.Is(err, context.Canceled) {
		t.Fatalf("ChooseOrganization() = %+v, %v; want cancellation", chosen, err)
	}
}
