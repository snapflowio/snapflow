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

	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
)

const (
	CheckIsolationProbe = "isolation-probe"
	// isolationCheckPrefix names one check per boundary the probe tests.
	isolationCheckPrefix = "isolation-"

	isolationProbeDetail      = "stand-in guests in two sandbox namespaces met every network boundary"
	reachableDetail           = "guest reaches "
	blockedDetail             = "guest cannot reach "
	isolationBoundaryFix      = "do not serve sandboxes from this machine; a sandbox network boundary is open. "
	isolationUpdateFix        = "update Snapflow and rerun the probe, and report the output of `snapflow doctor --isolation --json` if it persists"
	isolationInternetFix      = "check the host's internet access and that no host firewall drops traffic forwarded from sfh* interfaces"
	isolationSandboxesRunning = "stop Snapflow so no sandbox is running, then "
)

var errIsolationProbeNotRun = errors.New("not run; it builds throwaway sandbox networks, so it only runs on request")

// checkIsolationProbe reports the live isolation probe, which needs root and
// a stopped Snapflow, as one required check per boundary.
func (report *Diagnosis) checkIsolationProbe(ctx context.Context, cfg *config.Config, run bool) {
	rerun := text.Run(text.ProfileCommand(text.CommandDoctorIsolation, string(cfg.Profile.Name)))
	if !run {
		report.add(CheckIsolationProbe, false, errIsolationProbeNotRun, "", isolationSandboxesRunning+rerun)
		return
	}
	probeConfig := network.DefaultConfig()
	probeConfig.HostServicePorts = cfg.Runtime.HostServicePorts
	outcomes, err := network.ProbeIsolation(ctx, probeConfig)
	for _, outcome := range outcomes {
		report.add(isolationCheckPrefix+outcome.Boundary, true, outcome.Err, boundaryDetail(outcome), boundaryRemediation(outcome))
	}
	if err == nil {
		return
	}
	remediation := isolationUpdateFix
	if errors.Is(err, network.ErrSandboxesRunning) {
		remediation = isolationSandboxesRunning + rerun
	}
	report.add(CheckIsolationProbe, true, err, isolationProbeDetail, remediation)
}

func boundaryDetail(outcome network.ProbeOutcome) string {
	if outcome.Reachable {
		return reachableDetail + outcome.Target
	}
	return blockedDetail + outcome.Target
}

func boundaryRemediation(outcome network.ProbeOutcome) string {
	if outcome.Boundary == network.BoundaryInternet {
		return isolationInternetFix
	}
	return isolationBoundaryFix + isolationUpdateFix
}
