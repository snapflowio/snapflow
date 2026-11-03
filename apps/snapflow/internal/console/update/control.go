// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package update

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	publishStatusOperation    = "publish Snapflow update status"
	inspectDrainOperation     = "inspect Snapflow update drain"
	inspectReadinessOperation = "inspect updated machine readiness"
	drainTimeoutMessage       = "Snapflow update drain did not reach zero allocated work"
	readinessTimeoutMessage   = "updated machine did not publish full readiness"
)

type controlPlaneConnection struct {
	client   *control.Client
	identity *state.Identity
	session  *control.Session
}

func connectControlPlane(ctx context.Context, stateDirectory string) (*controlPlaneConnection, error) {
	identity, err := state.LoadIdentity(ctx, stateDirectory)
	if err != nil {
		return nil, err
	}
	client, err := control.NewForIdentity(identity)
	if err != nil {
		return nil, fmt.Errorf("configure machine control-plane client: %w", err)
	}
	connection := &controlPlaneConnection{client: client, identity: identity}
	if err := connection.openSession(ctx); err != nil {
		return nil, err
	}
	return connection, nil
}

func (connection *controlPlaneConnection) openSession(ctx context.Context) error {
	if connection.session != nil {
		return nil
	}
	sessionService, err := control.CreateSession(ctx, connection.client, connection.identity.MachineID)
	if err != nil {
		return fmt.Errorf("establish Snapflow update session: %w", err)
	}
	connection.session = sessionService
	return nil
}

func (connection *controlPlaneConnection) handoff() {
	connection.client.ClearSession()
	connection.session = nil
}

func (connection *controlPlaneConnection) close(ctx context.Context) error {
	if connection.session == nil {
		return nil
	}
	err := connection.session.Close(ctx)
	connection.session = nil
	return err
}

func (connection *controlPlaneConnection) finish(ctx context.Context, cfg Config, resultErr error) error {
	if resultErr != nil && connection.session != nil {
		reportContext, cancelReport := context.WithTimeout(context.WithoutCancel(ctx), cfg.PollInterval)
		defer cancelReport()
		resultErr = errors.Join(resultErr, connection.publishStatus(reportContext, cfg.Profile, PhaseFailed, nil, resultErr.Error()))
	}
	return errors.Join(resultErr, connection.close(context.WithoutCancel(ctx)))
}

func (connection *controlPlaneConnection) drain(ctx context.Context, cfg Config, change activation) error {
	response, err := connection.client.RequestAuthenticatedMachineUpdateDrainWithResponse(ctx)
	requested, err := apierror.Decode(
		change.drainOperation, response, err,
		(*apiclient.RequestAuthenticatedMachineUpdateDrainResult).GetJSON200,
	)
	if err != nil {
		return err
	}
	if err := connection.publishStatus(ctx, cfg.Profile, PhaseDraining, change.candidate, ""); err != nil {
		return err
	}
	drainContext, cancelDrain := context.WithTimeout(ctx, cfg.DrainTimeout)
	defer cancelDrain()
	return waitForNoWork(drainContext, connection.client, requested, cfg.PollInterval)
}

func (connection *controlPlaneConnection) publishStatus(
	ctx context.Context,
	selectedProfile config.Profile,
	phase Phase,
	candidate *install.ReleaseRecord,
	failure string,
) error {
	if err := saveStatus(selectedProfile, phase, candidate, failure); err != nil {
		return err
	}
	status, err := Inspect(selectedProfile)
	if err != nil {
		return err
	}
	payload, err := apiUpdateStatus(status)
	if err != nil {
		return err
	}
	response, err := connection.client.ReportAuthenticatedMachineUpdateStatusWithResponse(ctx, payload)
	return apierror.CheckResponse(publishStatusOperation, response, err)
}

func apiUpdatePhases() map[Phase]apiclient.MachineUpdatePhase {
	return map[Phase]apiclient.MachineUpdatePhase{
		PhaseIdle: apiclient.MachineUpdatePhaseIdle, PhaseStaged: apiclient.MachineUpdatePhaseStaged,
		PhaseDraining: apiclient.MachineUpdatePhaseDraining, PhaseActivating: apiclient.MachineUpdatePhaseActivating,
		PhaseReady: apiclient.MachineUpdatePhaseReady, PhaseFailed: apiclient.MachineUpdatePhaseFailed,
	}
}

func apiUpdateStatus(status Status) (apiclient.MachineUpdateStatusDto, error) {
	apiPhase, found := apiUpdatePhases()[status.Phase]
	if !found {
		return apiclient.MachineUpdateStatusDto{}, fmt.Errorf("unsupported Snapflow update phase %q", status.Phase)
	}
	payload := apiclient.MachineUpdateStatusDto{
		Channel:           status.Channel,
		MaintenanceWindow: status.MaintenanceWindow,
		Phase:             apiPhase,
		UpdatedAt:         status.UpdatedAt,
	}
	releases := []struct {
		record *install.ReleaseRecord
		target **apiclient.MachineReleaseSummaryDto
	}{
		{record: status.Candidate, target: &payload.Candidate},
		{record: status.Active, target: &payload.Active},
		{record: status.Previous, target: &payload.Previous},
	}
	for _, release := range releases {
		if release.record == nil {
			continue
		}
		summary, err := apiReleaseSummary(release.record)
		if err != nil {
			return apiclient.MachineUpdateStatusDto{}, err
		}
		*release.target = &summary
	}
	if status.LastFailure != "" {
		lastFailure := status.LastFailure
		payload.LastFailure = &lastFailure
	}
	return payload, nil
}

func apiReleaseSummary(record *install.ReleaseRecord) (apiclient.MachineReleaseSummaryDto, error) {
	return apiclient.MachineReleaseSummaryDto{
		Digest: record.Digest, Channel: string(record.Channel), Version: record.Version,
		InstalledAt: record.InstalledAt,
	}, nil
}

func waitForNoWork(ctx context.Context, client *control.Client, initial *apiclient.Machine, interval time.Duration) error {
	if noAllocatedWork(
		initial.CurrentStartedSandboxes, initial.CurrentAllocatedCpu,
		initial.CurrentAllocatedMemoryGiB, initial.CurrentAllocatedDiskGiB,
	) {
		return nil
	}
	return poll(ctx, interval, func() (bool, error) {
		response, err := client.GetInfoForAuthenticatedMachineWithResponse(ctx)
		machine, err := apierror.Decode(
			inspectDrainOperation, response, err, (*apiclient.GetInfoForAuthenticatedMachineResult).GetJSON200,
		)
		if err != nil {
			return false, err
		}
		return noAllocatedWork(
			machine.CurrentStartedSandboxes, machine.CurrentAllocatedCpu,
			machine.CurrentAllocatedMemoryGiB, machine.CurrentAllocatedDiskGiB,
		), nil
	}, drainTimeoutMessage)
}

func noAllocatedWork(allocations ...*float32) bool {
	for _, allocation := range allocations {
		if allocation != nil && *allocation != 0 {
			return false
		}
	}
	return true
}

func WaitForReadiness(
	ctx context.Context,
	client *control.Client,
	machineID string,
	interval time.Duration,
) error {
	machineUUID, err := uuid.Parse(machineID)
	if err != nil {
		return fmt.Errorf("parse machine ID: %w", err)
	}
	requestBody := apiclient.CreateMachineSessionDto{MachineId: machineUUID}
	return poll(ctx, interval, func() (bool, error) {
		response, err := client.GetMachineIdentityStatusWithResponse(ctx, requestBody)
		if err := apierror.CheckResponse(inspectReadinessOperation, response, err); err != nil {
			if apierror.IsRetryable(err) {
				return false, nil
			}
			return false, err
		}
		machine := response.JSON200
		if machine == nil {
			return false, nil
		}
		if machine.State == apiclient.MachineStateFailed {
			return false, fmt.Errorf("machine readiness failed: %s", readinessReason(machine))
		}
		return machine.State == apiclient.MachineStateReady && !machine.Unschedulable && !machine.Draining, nil
	}, readinessTimeoutMessage)
}

func readinessReason(machine *apiclient.MachineIdentityStatus) string {
	if machine.ReadinessReason == nil {
		return ""
	}
	return *machine.ReadinessReason
}

func poll(ctx context.Context, interval time.Duration, check func() (bool, error), timeoutMessage string) error {
	for {
		complete, err := check()
		if err != nil || complete {
			return err
		}
		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("%s: %w", timeoutMessage, ctx.Err())
		case <-timer.C:
		}
	}
}
