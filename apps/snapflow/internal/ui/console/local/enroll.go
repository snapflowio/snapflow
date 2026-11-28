// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package local

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/network/control"
	"github.com/snapflowio/snapflow/internal/supplychain/release"
	"github.com/snapflowio/snapflow/internal/supplychain/tuf"
)

const enrollmentUnconfirmed = "could not confirm this machine's enrollment with the control plane:"

type EnrollPhase string

const (
	EnrollPhaseInspection EnrollPhase = "inspection"
	EnrollPhasePreflight  EnrollPhase = "preflight"
	EnrollPhaseRelease    EnrollPhase = "release"
	EnrollPhaseEnrollment EnrollPhase = "enrollment"
	EnrollPhaseService    EnrollPhase = "service"
)

func EnrollPhases(profile config.ProfileName) []EnrollPhase {
	if profile == config.Development {
		return []EnrollPhase{EnrollPhaseInspection, EnrollPhaseEnrollment}
	}
	return []EnrollPhase{
		EnrollPhaseInspection, EnrollPhasePreflight, EnrollPhaseRelease, EnrollPhaseEnrollment, EnrollPhaseService,
	}
}

type EnrollNote string

const (
	EnrollNoteReleaseVerified EnrollNote = "release-verified"
	EnrollNoteAlreadyEnrolled EnrollNote = "already-enrolled"
)

var (
	ErrHostNotReady       = errors.New("this machine does not meet Snapflow's requirements")
	ErrMachineRevoked     = errors.New("this machine's enrollment was revoked or deleted in the dashboard")
	ErrIdentityUnreadable = errors.New("this machine's stored keys can no longer be read, usually because the operating system was reinstalled or the disk moved to another machine")
)

type EnrollProgress struct {
	Phase EnrollPhase
	Step  int
	Total int
	Note  EnrollNote
}

type EnrollObserver interface {
	PhaseStarted(EnrollProgress)
	PhaseFinished(EnrollProgress)
	CheckCompleted(doctor.DiagnosticCheck)
}

type EnrollService interface {
	InstallSystemFiles(context.Context, config.Profile, io.Writer) error
	EnableAndStart(context.Context) error
	EnableUpdates(context.Context) error
}

type EnrollConfig struct {
	Profile config.ProfileName
	Channel tuf.Channel
	APIURL  string
	Name    string
	Token   string
	Version string
	Service EnrollService
	Log     io.Writer
}

type EnrollResult struct {
	Profile        config.ProfileName `json:"profile"`
	MachineID      string             `json:"machineId,omitempty"`
	OrganizationID string             `json:"organizationId,omitempty"`
	HostAddress    string             `json:"hostAddress,omitempty"`
	Enrolled       bool               `json:"enrolled"`
	DashboardURL   string             `json:"dashboardUrl"`
	MachineURL     string             `json:"machineUrl,omitempty"`
	PayoutsURL     string             `json:"payoutsUrl,omitempty"`
	Ready          bool               `json:"ready"`
	Completed      []EnrollPhase      `json:"completed"`
}

type Enrollment struct {
	cfg     EnrollConfig
	profile config.Profile
	machine *config.Config
}

type enrollRun struct {
	*Enrollment
	observer EnrollObserver
	enroll   bool
	result   *EnrollResult
}

type enrollStep func(context.Context) (EnrollNote, error)

func NewEnrollment(cfg EnrollConfig) (*Enrollment, error) {
	if cfg.Log == nil {
		return nil, errors.New("the Snapflow enrollment log output is required")
	}
	if cfg.Service == nil && cfg.Profile != config.Development {
		return nil, errors.New("the Snapflow service manager is required")
	}
	profile, err := config.RuntimeProfile(cfg.Profile)
	if err != nil {
		return nil, err
	}
	machine, err := config.Load(cfg.Profile)
	if err != nil {
		return nil, fmt.Errorf("load Snapflow configuration: %w", err)
	}
	return &Enrollment{cfg: cfg, profile: profile, machine: machine}, nil
}

func (enrollment *Enrollment) Run(ctx context.Context, observer EnrollObserver) (EnrollResult, error) {
	result := EnrollResult{
		Profile: enrollment.cfg.Profile, DashboardURL: enrollment.profile.DashboardURL, Completed: []EnrollPhase{},
	}
	if observer == nil {
		return result, errors.New("the Snapflow enrollment observer is required")
	}
	run := &enrollRun{Enrollment: enrollment, observer: observer, result: &result}
	steps := map[EnrollPhase]enrollStep{
		EnrollPhaseInspection: run.inspect,
		EnrollPhasePreflight:  run.preflight,
		EnrollPhaseRelease:    run.installRelease,
		EnrollPhaseEnrollment: run.enrollMachine,
		EnrollPhaseService:    run.startService,
	}
	phases := EnrollPhases(enrollment.cfg.Profile)
	for index, phase := range phases {
		progress := EnrollProgress{Phase: phase, Step: index + 1, Total: len(phases)}
		observer.PhaseStarted(progress)
		note, err := steps[phase](ctx)
		if err != nil {
			return result, err
		}
		progress.Note = note
		observer.PhaseFinished(progress)
		result.Completed = append(result.Completed, phase)
	}
	pages := newDashboardPages(enrollment.profile, result.MachineID)
	result.MachineURL, result.PayoutsURL = pages.machine(), pages.payouts()
	result.Ready = true
	return result, nil
}

func (run *enrollRun) inspect(ctx context.Context) (EnrollNote, error) {
	directory := run.machine.Machine.StateDirectory
	_, err := state.Inspect(ctx, directory)
	if errors.Is(err, state.ErrNotRegistered) {
		run.enroll = true
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read this machine's enrollment state in %s: %w", directory, err)
	}
	identity, err := state.LoadIdentity(ctx, directory)
	if errors.Is(err, state.ErrIdentityKeyUnavailable) {
		return "", run.reenroll(fmt.Errorf("%w: %w", ErrIdentityUnreadable, err))
	}
	if err != nil {
		return "", fmt.Errorf("load this machine's identity from %s: %w", directory, err)
	}
	_, err = fetchIdentityStatus(ctx, identity)
	switch {
	case identityRevoked(err):
		return "", run.reenroll(fmt.Errorf("%w: %w", ErrMachineRevoked, err))
	case err != nil:
		fmt.Fprintln(run.cfg.Log, enrollmentUnconfirmed, err)
	}
	run.recordIdentity(identity)
	return "", nil
}

func (run *enrollRun) reenroll(cause error) error {
	if strings.TrimSpace(run.cfg.Token) == "" {
		return cause
	}
	run.enroll = true
	return nil
}

func (run *enrollRun) preflight(ctx context.Context) (EnrollNote, error) {
	report := doctor.CheckMachine(ctx, doctor.DiagnoseConfig{Config: run.machine, Observe: run.observer.CheckCompleted})
	if !report.Ready {
		return "", ErrHostNotReady
	}
	return "", nil
}

func (run *enrollRun) installRelease(ctx context.Context) (EnrollNote, error) {
	if _, err := release.LoadActive(run.profile.InstallationRoot, true); err == nil {
		return EnrollNoteReleaseVerified, nil
	}
	channel, err := install.SelectChannel(run.profile, run.cfg.Channel)
	if err != nil {
		return "", fmt.Errorf("select the release channel: %w", err)
	}
	if _, err := install.Install(ctx, run.profile, channel); err != nil {
		return "", fmt.Errorf("install verified Snapflow release: %w", err)
	}
	return "", nil
}

func (run *enrollRun) enrollMachine(ctx context.Context) (EnrollNote, error) {
	if !run.enroll {
		return EnrollNoteAlreadyEnrolled, nil
	}
	name, err := machineName(run.cfg.Name)
	if err != nil {
		return "", err
	}
	apiURL := run.cfg.APIURL
	if apiURL == "" {
		apiURL = run.profile.APIURL
	}
	if err := run.profile.ValidateAPIURL(apiURL); err != nil {
		return "", fmt.Errorf("validate control-plane API: %w", err)
	}
	keys, err := state.GenerateEnrollmentKeys()
	if err != nil {
		return "", fmt.Errorf("generate this machine's identity and host keys: %w", err)
	}
	identity, err := control.Enroll(ctx, control.Enrollment{
		APIURL: apiURL, Name: name, Token: run.cfg.Token, Version: run.cfg.Version,
	}, keys)
	if err != nil {
		return "", fmt.Errorf("enroll %q with %s: %w", name, apiURL, err)
	}
	if err := state.SaveIdentity(ctx, run.machine.Machine.StateDirectory, identity); err != nil {
		return "", fmt.Errorf("save this machine's identity: %w", err)
	}
	run.recordIdentity(identity)
	run.result.Enrolled = true
	return "", nil
}

func (run *enrollRun) startService(ctx context.Context) (EnrollNote, error) {
	if err := run.cfg.Service.InstallSystemFiles(ctx, run.profile, run.cfg.Log); err != nil {
		return "", err
	}
	if err := run.cfg.Service.EnableAndStart(ctx); err != nil {
		return "", fmt.Errorf("enable Snapflow service: %w", err)
	}
	if err := run.cfg.Service.EnableUpdates(ctx); err != nil {
		return "", fmt.Errorf("enable verified Snapflow updates: %w", err)
	}
	return "", nil
}

func (run *enrollRun) recordIdentity(identity *state.Identity) {
	run.result.MachineID, run.result.OrganizationID = identity.MachineID, identity.OrganizationID
	run.result.HostAddress = identity.HostKey.Address().Hex()
}

func machineName(override string) (string, error) {
	if name := strings.TrimSpace(override); name != "" {
		return name, nil
	}
	name, err := os.Hostname()
	if err != nil {
		return "", fmt.Errorf("resolve this machine's hostname: %w", err)
	}
	return name, nil
}
