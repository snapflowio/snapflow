// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import "fmt"

type Phase string

const (
	PhaseAcquireLease       Phase = "acquire Snapflow process lease"
	PhaseLoadRelease        Phase = "validate active release"
	PhaseHostPreflight      Phase = "microVM host preflight"
	PhaseOpenState          Phase = "open Snapflow state"
	PhaseLoadIdentity       Phase = "load machine identity"
	PhaseCreateSession      Phase = "create machine session"
	PhaseResolvePolicy      Phase = "resolve control policy"
	PhasePrepareRuntime     Phase = "prepare microVM runtime"
	PhasePrepareSSHGateway  Phase = "prepare SSH gateway"
	PhasePrepareTunnels     Phase = "prepare Edge tunnels"
	PhasePrepareUsage       Phase = "prepare usage reporting"
	PhasePrepareSnapshots   Phase = "prepare snapshot inventory"
	PhasePrepareConvergence Phase = "prepare sandbox convergence"
	PhasePrepareSettlement  Phase = "prepare payment vouchers"
	PhasePrepareHealth      Phase = "prepare health reporting"
	PhasePrepareExecutor    Phase = "prepare job executor"
	PhasePrepareAPI         Phase = "prepare Snapflow API"
	PhasePublishReady       Phase = "publish ready healthcheck"
)

type PhaseError struct {
	Phase Phase
	Err   error
}

func (err *PhaseError) Error() string {
	return fmt.Sprintf("%s: %v", err.Phase, err.Err)
}

func (err *PhaseError) Unwrap() error { return err.Err }

func phaseError(phase Phase, err error) error {
	return &PhaseError{Phase: phase, Err: err}
}
