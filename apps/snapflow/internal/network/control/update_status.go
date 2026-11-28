// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"fmt"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/install"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const reportUpdateStatusOperation = "report the machine's update status"

func (client *Client) ReportUpdateStatus(ctx context.Context, status install.UpdateStatus) error {
	payload, err := UpdateStatusReport(status)
	if err != nil {
		return err
	}
	response, err := client.ReportAuthenticatedMachineUpdateStatusWithResponse(ctx, payload)
	return apierror.CheckResponse(reportUpdateStatusOperation, response, err)
}

func apiUpdatePhases() map[install.UpdatePhase]apiclient.MachineUpdatePhase {
	return map[install.UpdatePhase]apiclient.MachineUpdatePhase{
		install.UpdatePhaseIdle:       apiclient.MachineUpdatePhaseIdle,
		install.UpdatePhaseStaged:     apiclient.MachineUpdatePhaseStaged,
		install.UpdatePhaseDraining:   apiclient.MachineUpdatePhaseDraining,
		install.UpdatePhaseActivating: apiclient.MachineUpdatePhaseActivating,
		install.UpdatePhaseReady:      apiclient.MachineUpdatePhaseReady,
		install.UpdatePhaseFailed:     apiclient.MachineUpdatePhaseFailed,
	}
}

func UpdateStatusReport(status install.UpdateStatus) (apiclient.MachineUpdateStatusDto, error) {
	apiPhase, found := apiUpdatePhases()[status.Phase]
	if !found {
		return apiclient.MachineUpdateStatusDto{}, fmt.Errorf("unsupported Snapflow update phase %q", status.Phase)
	}
	payload := apiclient.MachineUpdateStatusDto{
		Channel:           status.Channel,
		MaintenanceWindow: status.MaintenanceWindow,
		Phase:             apiPhase,
		UpdatedAt:         status.UpdatedAt,
		Candidate:         releaseSummary(status.Candidate),
		Active:            releaseSummary(status.Active),
		Previous:          releaseSummary(status.Previous),
	}
	if status.LastFailure != "" {
		lastFailure := status.LastFailure
		payload.LastFailure = &lastFailure
	}
	return payload, nil
}

func releaseSummary(record *install.ReleaseRecord) *apiclient.MachineReleaseSummaryDto {
	if record == nil {
		return nil
	}
	return &apiclient.MachineReleaseSummaryDto{
		Digest: record.Digest, Channel: string(record.Channel), Version: record.Version, InstalledAt: record.InstalledAt,
	}
}
