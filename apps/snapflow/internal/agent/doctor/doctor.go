// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package doctor

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/supplychain/release"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
)

const (
	CheckRelease             = "release"
	CheckReadinessContract   = "readiness-contract"
	CheckRegistration        = "registration"
	CheckProfileControlPlane = "profile-control-plane"
	CheckAPI                 = "api"
	CheckGuestRegistry       = "guest-registry"
	CheckEdge                = "edge"
	CheckBenchmark           = "benchmark"
)

type CheckStatus string

const (
	CheckPassed  CheckStatus = "ok"
	CheckPending CheckStatus = "pending"
	CheckFailed  CheckStatus = "failed"
)

type DiagnosticCheck struct {
	Name        string      `json:"name"`
	Status      CheckStatus `json:"status"`
	Required    bool        `json:"required"`
	Detail      string      `json:"detail"`
	Remediation string      `json:"remediation,omitempty"`
}

type Diagnosis struct {
	Profile   config.ProfileName `json:"profile"`
	Ready     bool               `json:"ready"`
	Checks    []DiagnosticCheck  `json:"checks"`
	Benchmark *BenchmarkReport   `json:"benchmark,omitempty"`
	observe   func(DiagnosticCheck)
}

type DiagnoseConfig struct {
	Config           *config.Config
	Observe          func(DiagnosticCheck)
	Isolation        bool
	BenchmarkSamples int
}

type remediations struct {
	release      string
	registration string
	benchmark    string
	api          string
	registry     string
}

const (
	readinessContractDetail = "installed release maps to the canonical machine readiness payload"
	edgeDetail              = "Edge assignment is fetched after each authenticated machine session"
	edgeRemediation         = "start Edge before Snapflow"
	profileAPIRemediation   = "enroll again with the API owned by the selected profile"
	enrollRemediation       = "enroll this machine"
	enrollAPIRemediation    = "enroll this machine, then rerun doctor"
	developmentAPIFix       = "start the development API, then rerun doctor"
	developmentRegistryFix  = "start the local registry and rerun runtime preparation"
	productionNetworkFix    = "check this machine's internet access, DNS and any proxy or firewall rule for "
	healthEndpoint          = "health"
)

var (
	errReleaseUnavailable      = errors.New("not checked because the Snapflow release is unavailable")
	errRegistrationUnavailable = errors.New("not checked because machine registration is unavailable")
	errBenchmarkMissing        = errors.New("no benchmark report yet; `snapflow doctor --benchmark` records one")
)

func Diagnose(ctx context.Context, cfg DiagnoseConfig) Diagnosis {
	configuration := cfg.Config
	report := newDiagnosis(cfg)
	report.checkMachine(ctx, configuration)
	report.checkIsolationProbe(ctx, configuration, cfg.Isolation)
	fixes := profileRemediations(configuration.Profile)
	active, releaseErr := release.LoadActive(configuration.Runtime.ReleaseRoot, true)
	if releaseErr != nil {
		releaseErr = fmt.Errorf("load the verified release from %s: %w", configuration.Runtime.ReleaseRoot, releaseErr)
	}
	report.add(CheckRelease, true, releaseErr, releaseDetail(active), fixes.release)
	readinessContractErr := errReleaseUnavailable
	if releaseErr == nil {
		readinessContractErr = validateReadinessPayload(ctx, active)
	}
	report.add(CheckReadinessContract, true, readinessContractErr, readinessContractDetail, fixes.release)
	report.checkRegistration(ctx, configuration, fixes)
	report.add(CheckGuestRegistry, true, registry(ctx, configuration.Profile, active), active.Manifest.Guest.Reference,
		fixes.registry)
	report.add(CheckEdge, false, nil, edgeDetail, edgeRemediation)
	report.checkBenchmark(ctx, configuration, cfg.BenchmarkSamples, fixes.benchmark)
	return report
}

func (report *Diagnosis) checkBenchmark(ctx context.Context, cfg *config.Config, samples int, remediation string) {
	benchmarkPath := BenchmarkPath(cfg)
	if samples <= 0 {
		_, err := os.Stat(benchmarkPath)
		if errors.Is(err, os.ErrNotExist) {
			err = errBenchmarkMissing
		}
		report.add(CheckBenchmark, false, err, benchmarkPath, remediation)
		return
	}
	measured, err := Benchmark(ctx, cfg, samples)
	if err == nil {
		report.Benchmark = &measured
	}
	report.add(CheckBenchmark, true, err, benchmarkPath, remediation)
}

func (report *Diagnosis) checkRegistration(ctx context.Context, cfg *config.Config, fixes remediations) {
	inspection, registrationErr := state.Inspect(ctx, cfg.Machine.StateDirectory)
	report.add(CheckRegistration, true, registrationErr, registrationDetail(inspection), fixes.registration)
	if registrationErr != nil {
		report.add(CheckProfileControlPlane, true, errRegistrationUnavailable, "", enrollRemediation)
		report.add(CheckAPI, true, errRegistrationUnavailable, "", enrollAPIRemediation)
		return
	}
	report.add(CheckProfileControlPlane, true, cfg.Profile.ValidateAPIURL(inspection.APIURL), inspection.APIURL,
		profileAPIRemediation)
	apiErr := endpointStatus(ctx, inspection.APIURL, healthEndpoint)
	apiFix := fixes.api
	if cfg.Profile.Name != config.Development {
		apiFix = productionNetworkFix + inspection.APIURL
	}
	report.add(CheckAPI, true, apiErr, inspection.APIURL, apiFix)
}

func profileRemediations(selected config.Profile) remediations {
	if selected.Name == config.Development {
		return remediations{
			release:      text.Run(text.DevelopmentBootstrapTask),
			registration: text.Run(text.DevelopmentServeTask),
			benchmark:    text.Run(text.DevelopmentBenchmarkTask),
			api:          developmentAPIFix,
			registry:     developmentRegistryFix,
		}
	}
	profile := string(selected.Name)
	return remediations{
		release:      text.Run(text.ProfileCommand(text.CommandEnrollAgain, profile)) + text.ReinstallNote,
		registration: text.AddMachineHint,
		benchmark:    text.Run(text.ProfileCommand(text.CommandDoctorBenchmark, profile)),
		api:          productionNetworkFix + selected.APIURL,
		registry:     productionNetworkFix + selected.GuestRegistryOrigin,
	}
}

func newDiagnosis(cfg DiagnoseConfig) Diagnosis {
	return Diagnosis{Profile: cfg.Config.Profile.Name, Ready: true, Checks: []DiagnosticCheck{}, observe: cfg.Observe}
}

func (report *Diagnosis) add(name string, required bool, err error, detail, remediation string) {
	status := CheckPassed
	if err != nil {
		status = CheckPending
		detail = err.Error()
		if required {
			status = CheckFailed
			report.Ready = false
		}
	}
	check := DiagnosticCheck{Name: name, Status: status, Required: required, Detail: detail, Remediation: remediation}
	report.Checks = append(report.Checks, check)
	if report.observe != nil {
		report.observe(check)
	}
}

func releaseDetail(verified release.VerifiedRelease) string {
	if verified.Root == "" {
		return "no verified release"
	}
	return fmt.Sprintf("version=%s digest=%s protocol=%d",
		verified.Manifest.Version, verified.BundleDigest,
		verified.Manifest.Guest.ControlProtocolVersion)
}

func registrationDetail(inspection state.Inspection) string {
	if !inspection.Registered {
		return "not enrolled"
	}
	return fmt.Sprintf("machine=%s organization=%s host=%s", inspection.MachineID, inspection.OrganizationID, inspection.HostAddress)
}
