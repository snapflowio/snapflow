// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/console/update"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/tuf"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	setupReadinessTimeout      = 5 * time.Minute
	payoutReadinessUnavailable = "could not read payout readiness:"
)

type SetupPhase string

const (
	SetupPhaseInspection    SetupPhase = "inspection"
	SetupPhasePreflight     SetupPhase = "preflight"
	SetupPhaseRelease       SetupPhase = "release"
	SetupPhaseAuthorization SetupPhase = "authorization"
	SetupPhaseService       SetupPhase = "service"
	SetupPhaseReadiness     SetupPhase = "readiness"
)

func SetupPhases(profile config.ProfileName) []SetupPhase {
	if profile == config.Development {
		return []SetupPhase{SetupPhaseInspection, SetupPhaseAuthorization}
	}
	return []SetupPhase{
		SetupPhaseInspection, SetupPhasePreflight, SetupPhaseRelease,
		SetupPhaseAuthorization, SetupPhaseService, SetupPhaseReadiness,
	}
}

type SetupNote string

const (
	SetupNoteReleaseVerified SetupNote = "release-verified"
	SetupNoteAlreadyApproved SetupNote = "already-approved"
)

var (
	ErrHostNotReady       = errors.New("this machine does not meet Snapflow's requirements")
	ErrMachineRevoked     = errors.New("this machine's registration was revoked or deleted in the dashboard")
	ErrIdentityUnreadable = errors.New("this machine's stored identity can no longer be read, usually because the operating system was reinstalled or the disk moved to another machine")
)

type SetupProgress struct {
	Phase SetupPhase
	Step  int
	Total int
	Note  SetupNote
}

type SetupInteraction interface {
	PhaseStarted(SetupProgress)
	PhaseFinished(SetupProgress)
	CheckCompleted(doctor.DiagnosticCheck)
	AuthorizationStarted(control.DeviceAuthorization)
	ChooseOrganization(context.Context, control.OrganizationChoice) (control.Organization, error)
}

type SetupService interface {
	InstallSystemFiles(context.Context, config.Profile, io.Writer) error
	EnableAndStart(context.Context, io.Writer, io.Writer) error
	EnableUpdates(context.Context, io.Writer, io.Writer) error
}

type SetupConfig struct {
	Profile      config.ProfileName
	Channel      tuf.Channel
	APIURL       string
	Name         string
	Organization string
	Replace      bool
	Service      SetupService
	Log          io.Writer
	Version      string
}

type SetupResult struct {
	Profile      config.ProfileName        `json:"profile"`
	MachineID    string                    `json:"machineId,omitempty"`
	OwnerID      string                    `json:"ownerId,omitempty"`
	DashboardURL string                    `json:"dashboardUrl"`
	Location     *apiclient.Location       `json:"location,omitempty"`
	Payouts      apiclient.PayoutReadiness `json:"payouts,omitempty"`
	Ready        bool                      `json:"ready"`
	Completed    []SetupPhase              `json:"completed"`
}

type Setup struct {
	cfg     SetupConfig
	profile config.Profile
	machine *config.Config
}

type setupRun struct {
	*Setup
	interaction SetupInteraction
	fresh       bool
	result      *SetupResult
}

type setupStep func(context.Context) (SetupNote, error)

func NewSetup(cfg SetupConfig) (*Setup, error) {
	if cfg.Log == nil {
		return nil, errors.New("the Snapflow setup log output is required")
	}
	if cfg.Service == nil && cfg.Profile != config.Development {
		return nil, errors.New("the Snapflow setup service is required")
	}
	profile, err := config.RuntimeProfile(cfg.Profile)
	if err != nil {
		return nil, err
	}
	machine, err := config.Load(cfg.Profile)
	if err != nil {
		return nil, fmt.Errorf("load Snapflow configuration: %w", err)
	}
	return &Setup{cfg: cfg, profile: profile, machine: machine}, nil
}

func (setup *Setup) Phases() []SetupPhase {
	return SetupPhases(setup.cfg.Profile)
}

func (setup *Setup) Run(ctx context.Context, interaction SetupInteraction) (SetupResult, error) {
	result := SetupResult{Profile: setup.cfg.Profile, DashboardURL: setup.profile.DashboardURL, Completed: []SetupPhase{}}
	if interaction == nil {
		return result, errors.New("the Snapflow setup interaction is required")
	}
	run := &setupRun{Setup: setup, interaction: interaction, result: &result}
	steps := map[SetupPhase]setupStep{
		SetupPhaseInspection:    run.inspect,
		SetupPhasePreflight:     run.preflight,
		SetupPhaseRelease:       run.installRelease,
		SetupPhaseAuthorization: run.authorize,
		SetupPhaseService:       run.startService,
		SetupPhaseReadiness:     run.awaitReadiness,
	}
	phases := setup.Phases()
	for index, phase := range phases {
		progress := SetupProgress{Phase: phase, Step: index + 1, Total: len(phases)}
		interaction.PhaseStarted(progress)
		note, err := steps[phase](ctx)
		if err != nil {
			return result, err
		}
		progress.Note = note
		interaction.PhaseFinished(progress)
		result.Completed = append(result.Completed, phase)
	}
	result.Ready = true
	return result, nil
}

func (run *setupRun) inspect(ctx context.Context) (SetupNote, error) {
	inspection, err := state.Inspect(ctx, run.machine.Machine.StateDirectory)
	if err != nil && !errors.Is(err, state.ErrNotRegistered) {
		return "", err
	}
	run.fresh = errors.Is(err, state.ErrNotRegistered)
	if run.fresh || run.cfg.Replace {
		return "", nil
	}
	run.result.MachineID, run.result.OwnerID = inspection.MachineID, inspection.OwnerID
	return "", run.requireActiveIdentity(ctx)
}

func (run *setupRun) requireActiveIdentity(ctx context.Context) error {
	identity, err := state.LoadIdentity(ctx, run.machine.Machine.StateDirectory)
	if errors.Is(err, state.ErrIdentityKeyUnavailable) {
		return fmt.Errorf("%w: %w", ErrIdentityUnreadable, err)
	}
	if err != nil {
		return err
	}
	_, err = fetchIdentityStatus(ctx, identity)
	if identityRevoked(err) {
		return ErrMachineRevoked
	}
	return nil
}

func (run *setupRun) preflight(ctx context.Context) (SetupNote, error) {
	report := doctor.CheckMachine(ctx, doctor.DiagnoseConfig{Config: run.machine, Observe: run.interaction.CheckCompleted})
	if !report.Ready {
		return "", ErrHostNotReady
	}
	return "", nil
}

func (run *setupRun) installRelease(ctx context.Context) (SetupNote, error) {
	if _, err := release.LoadActive(run.profile.InstallationRoot, true); err == nil {
		return SetupNoteReleaseVerified, nil
	}
	channel, err := install.SelectChannel(run.profile, run.cfg.Channel)
	if err != nil {
		return "", err
	}
	if _, err := install.Install(ctx, run.profile, channel); err != nil {
		return "", fmt.Errorf("install verified Snapflow release: %w", err)
	}
	return "", nil
}

func (run *setupRun) authorize(ctx context.Context) (SetupNote, error) {
	if !run.fresh && !run.cfg.Replace {
		return SetupNoteAlreadyApproved, nil
	}
	registered, err := Login(ctx, LoginConfig{
		Profile: run.cfg.Profile, APIURL: run.cfg.APIURL, Name: run.cfg.Name,
		Organization: run.cfg.Organization, Replace: run.cfg.Replace,
		OnAuthorization: run.interaction.AuthorizationStarted, ChooseOrganization: run.interaction.ChooseOrganization,
		Version: run.cfg.Version,
	})
	if err != nil {
		return "", err
	}
	run.result.MachineID, run.result.OwnerID = registered.MachineID, registered.OwnerID
	return "", nil
}

func (run *setupRun) startService(ctx context.Context) (SetupNote, error) {
	if err := run.cfg.Service.InstallSystemFiles(ctx, run.profile, run.cfg.Log); err != nil {
		return "", err
	}
	if err := run.cfg.Service.EnableAndStart(ctx, run.cfg.Log, run.cfg.Log); err != nil {
		return "", fmt.Errorf("enable Snapflow service: %w", err)
	}
	return "", nil
}

func (run *setupRun) awaitReadiness(ctx context.Context) (SetupNote, error) {
	identity, err := state.LoadIdentity(ctx, run.machine.Machine.StateDirectory)
	if err != nil {
		return "", err
	}
	client, err := control.NewForIdentity(identity)
	if err != nil {
		return "", err
	}
	readinessContext, cancelReadiness := context.WithTimeout(ctx, setupReadinessTimeout)
	err = update.WaitForReadiness(readinessContext, client, identity.MachineID, update.DefaultPollInterval)
	cancelReadiness()
	if err != nil {
		return "", err
	}
	if err := run.cfg.Service.EnableUpdates(ctx, run.cfg.Log, run.cfg.Log); err != nil {
		return "", fmt.Errorf("enable verified Snapflow updates: %w", err)
	}
	status, err := fetchIdentityStatus(ctx, identity)
	if err != nil {
		fmt.Fprintln(run.cfg.Log, payoutReadinessUnavailable, err)
		return "", nil
	}
	run.result.Location = status.Location
	run.result.Payouts = status.Payouts
	return "", nil
}
