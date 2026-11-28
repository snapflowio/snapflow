// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package hostreport

import (
	"context"
	"strconv"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	reportTrafficOperation = "report the machine's traffic"
	TrafficInterval        = 15 * time.Minute
	decimalBase            = 10
)

func TrafficReport(stored state.TrafficMonth, found bool, now time.Time) apiclient.MachineTrafficReport {
	month := now.UTC().Format(state.TrafficMonthLayout)
	if !found || stored.Month < month {
		return apiclient.MachineTrafficReport{Month: month, Bytes: "0", ObservedAt: now.UTC()}
	}
	return apiclient.MachineTrafficReport{
		Month: stored.Month, Bytes: strconv.FormatUint(stored.Bytes, decimalBase), ObservedAt: stored.ObservedAt.UTC(),
	}
}

func (reporter *Reporter) reportTraffic(ctx context.Context, now time.Time) error {
	stored, found, err := reporter.deps.Store.LoadTrafficMonth(ctx)
	if err != nil {
		return err
	}
	payload := TrafficReport(stored, found, now)
	if payload.Month == reporter.traffic.fingerprint && now.Sub(reporter.traffic.at) < TrafficInterval {
		return nil
	}
	if err := reporter.deps.Control.ReportTraffic(ctx, payload); err != nil {
		return err
	}
	reporter.traffic = sent{fingerprint: payload.Month, at: now}
	return nil
}

func (api *ControlPlane) ReportTraffic(ctx context.Context, traffic apiclient.MachineTrafficReport) error {
	response, err := api.client.ReportMachineTrafficWithResponse(ctx, traffic)
	return apierror.CheckResponse(reportTrafficOperation, response, err)
}
