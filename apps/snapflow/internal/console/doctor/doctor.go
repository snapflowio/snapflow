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
	"path/filepath"

	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/state"
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

const benchmarkFile = "benchmarks/latest.json"

type DiagnosticCheck struct {
	Name        string      `json:"name"`
	Status      CheckStatus `json:"status"`
	Required    bool        `json:"required"`
	Detail      string      `json:"detail"`
	Remediation string      `json:"remediation,omitempty"`
}

type Diagnosis struct {
	Profile config.ProfileName `json:"profile"`
	Ready   bool               `json:"ready"`
	Checks  []DiagnosticCheck  `json:"checks"`
	observe func(DiagnosticCheck)
}

type DiagnoseConfig struct {
	Config  *config.Config
	Observe func(DiagnosticCheck)
	// Isolation runs the live isolation probe, which needs Snapflow stopped.
	Isolation bool
}

type remediations struct {
	release      string
	registration string
	benchmark    string
}

func Diagnose(ctx context.Context, cfg DiagnoseConfig) Diagnosis {
	configuration := cfg.Config
	report := newDiagnosis(cfg)
	report.checkMachine(ctx, configuration)
	report.checkIsolationProbe(ctx, configuration, cfg.Isolation)
	fixes := profileRemediations(configuration.Profile.Name)
	active, releaseErr := release.LoadActive(configuration.Runtime.ReleaseRoot, true)
	report.add(CheckRelease, true, releaseErr, releaseDetail(active), fixes.release)
	readinessContractErr := errors.New("not checked because the Snapflow release is unavailable")
	if releaseErr == nil {
		readinessContractErr = validateReadinessPayload(ctx, active)
	}
	report.add(CheckReadinessContract, true, readinessContractErr,
		"installed release maps to the canonical machine readiness payload",
		"reinstall the verified Snapflow release and rerun doctor")
	report.checkRegistration(ctx, configuration, fixes.registration)
	report.add(CheckGuestRegistry, true, registry(ctx, configuration.Profile, active), active.Manifest.Guest.Reference,
		"start the local registry and rerun runtime preparation")
	report.add(CheckEdge, false, nil, "Edge assignment is fetched after each authenticated machine session", "start Edge before Snapflow")
	benchmarkPath := filepath.Join(configuration.Runtime.DataDirectory, benchmarkFile)
	_, benchmarkErr := os.Stat(benchmarkPath)
	report.add(CheckBenchmark, false, benchmarkErr, benchmarkPath, fixes.benchmark)
	return report
}

func (report *Diagnosis) checkRegistration(ctx context.Context, cfg *config.Config, remediation string) {
	inspection, registrationErr := state.Inspect(ctx, cfg.Machine.StateDirectory)
	report.add(CheckRegistration, true, registrationErr, registrationDetail(inspection), remediation)
	if registrationErr != nil {
		dependencyErr := errors.New("not checked because machine registration is unavailable")
		report.add(CheckProfileControlPlane, true, dependencyErr, "", "complete machine registration")
		report.add(CheckAPI, true, dependencyErr, "", "complete registration, then start the selected profile's API")
		return
	}
	report.add(CheckProfileControlPlane, true, cfg.Profile.ValidateAPIURL(inspection.APIURL), inspection.APIURL,
		"re-register with the API owned by the selected profile")
	report.add(CheckAPI, true, endpointStatus(ctx, inspection.APIURL, "health"), inspection.APIURL,
		"start the selected profile's API")
}

func profileRemediations(profile config.ProfileName) remediations {
	if profile == config.Development {
		return remediations{
			release:      text.Run(text.DevelopmentBootstrapTask),
			registration: text.Run(text.DevelopmentServeTask),
			benchmark:    text.Run(text.DevelopmentBenchmarkTask),
		}
	}
	return remediations{
		release:      text.Run(text.ProfileCommand(text.CommandSetup, string(profile))),
		registration: text.Run(text.ProfileCommand(text.CommandSetup, string(profile))),
		benchmark:    text.Run(text.ProfileCommand(text.CommandBenchmark, string(profile))),
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
		return "not registered"
	}
	return fmt.Sprintf("machine=%s owner=%s", inspection.MachineID, inspection.OwnerID)
}
