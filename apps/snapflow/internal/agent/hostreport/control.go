// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package hostreport

import (
	"context"
	"errors"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/network/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	reportDiagnosticsOperation  = "report the machine's diagnostics"
	reportPaymentHoldsOperation = "report the machine's payment holds"
	reportBenchmarkOperation    = "report the machine's benchmark"
	reportAbuseOperation        = "report the machine's sandbox abuse signals"
	reportConnectionsOperation  = "report the machine's sandbox connection records"
)

type Control interface {
	ReportDiagnostics(ctx context.Context, diagnostics apiclient.MachineDiagnostics) error
	ReportPaymentHolds(ctx context.Context, holds apiclient.MachinePaymentHolds) error
	ReportLocalBenchmark(ctx context.Context, benchmark apiclient.MachineLocalBenchmark) error
	ReportTraffic(ctx context.Context, traffic apiclient.MachineTrafficReport) error
}

type ControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (*ControlPlane, error) {
	if client == nil {
		return nil, errors.New("host report control-plane client is required")
	}
	return &ControlPlane{client: client}, nil
}

func (api *ControlPlane) ReportDiagnostics(ctx context.Context, diagnostics apiclient.MachineDiagnostics) error {
	response, err := api.client.ReportMachineDiagnosticsWithResponse(ctx, diagnostics)
	return apierror.CheckResponse(reportDiagnosticsOperation, response, err)
}

func (api *ControlPlane) ReportPaymentHolds(ctx context.Context, holds apiclient.MachinePaymentHolds) error {
	response, err := api.client.ReportMachinePaymentHoldsWithResponse(ctx, holds)
	return apierror.CheckResponse(reportPaymentHoldsOperation, response, err)
}

func (api *ControlPlane) ReportLocalBenchmark(ctx context.Context, benchmark apiclient.MachineLocalBenchmark) error {
	response, err := api.client.ReportMachineLocalBenchmarkWithResponse(ctx, benchmark)
	return apierror.CheckResponse(reportBenchmarkOperation, response, err)
}

func (api *ControlPlane) ReportConnections(ctx context.Context, report apiclient.MachineConnectionReport) error {
	response, err := api.client.ReportMachineConnectionsWithResponse(ctx, report)
	return apierror.CheckResponse(reportConnectionsOperation, response, err)
}

func (api *ControlPlane) ReportAbuseSignals(ctx context.Context, report apiclient.MachineAbuseReport) error {
	response, err := api.client.ReportMachineAbuseSignalsWithResponse(ctx, report)
	return apierror.CheckResponse(reportAbuseOperation, response, err)
}
