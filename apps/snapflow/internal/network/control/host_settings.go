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
	"math"
	"net/http"
	"net/netip"
	"slices"
	"strconv"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/install"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	fetchHostSettingsOperation = "fetch the machine's host settings"
	HostSettingsSchemaVersion  = 4
	entityTagQuote             = `"`
	decimalBase                = 10
	int64Bits                  = 64
	kilobitsPerMegabit         = 1000
	bitsPerKilobit             = 1000
)

type HostSettings struct {
	MaintenanceWindow *install.MaintenanceWindow
	Daemon            state.HostSettings
}

func (client *Client) FetchHostSettings(
	ctx context.Context,
	digest string,
) (*apiclient.MachineHostSettingsDocument, bool, error) {
	waitSeconds := int(LongPollWait / time.Second)
	params := &apiclient.GetMachineHostSettingsParams{WaitSeconds: &waitSeconds}
	if digest != "" {
		entityTag := entityTagQuote + digest + entityTagQuote
		params.IfNoneMatch = &entityTag
	}
	response, err := client.GetMachineHostSettingsWithResponse(ctx, params)
	if err == nil && response.StatusCode() == http.StatusNotModified {
		return nil, false, nil
	}
	document, err := apierror.Decode(
		fetchHostSettingsOperation, response, err, (*apiclient.GetMachineHostSettingsResult).GetJSON200,
	)
	if err != nil {
		return nil, false, CheckRemoved(err)
	}
	return document, true, nil
}

func HostSettingsFromDocument(document *apiclient.MachineHostSettingsDocument) (HostSettings, error) {
	if document.SchemaVersion != HostSettingsSchemaVersion {
		return HostSettings{}, fmt.Errorf("unsupported host settings schema %d", document.SchemaVersion)
	}
	settings := HostSettings{Daemon: state.HostSettings{
		OfferedVCPUs:     optionalCount(document.Offer.Vcpus),
		OfferedMemoryGiB: optionalCount(document.Offer.MemoryGiB),
		OfferedDiskGiB:   optionalCount(document.Offer.DiskGiB),
	}}
	if document.MaxUnclaimedFloat != nil {
		float, err := strconv.ParseInt(*document.MaxUnclaimedFloat, decimalBase, int64Bits)
		if err != nil {
			return HostSettings{}, fmt.Errorf("invalid maximum unclaimed float %q: %w", *document.MaxUnclaimedFloat, err)
		}
		settings.Daemon.MaxUnclaimedFloat = &float
	}
	traffic, err := trafficSettings(document.Traffic)
	if err != nil {
		return HostSettings{}, err
	}
	settings.Daemon.Traffic = &traffic
	if settings.Daemon.PublicAddresses, err = publicAddresses(document.PublicAddresses); err != nil {
		return HostSettings{}, err
	}
	if document.MaintenanceWindow != nil {
		window := install.MaintenanceWindow{
			StartMinuteUTC:  document.MaintenanceWindow.StartMinuteUtc,
			DurationMinutes: document.MaintenanceWindow.DurationMinutes,
		}
		if err := window.Validate(); err != nil {
			return HostSettings{}, err
		}
		settings.MaintenanceWindow = &window
	}
	return settings, nil
}

func publicAddresses(values []string) ([]netip.Addr, error) {
	addresses := make([]netip.Addr, 0, len(values))
	for _, value := range values {
		address, err := netip.ParseAddr(value)
		if err != nil || !address.Is4() {
			return nil, fmt.Errorf("the host settings carry an invalid public IPv4 address %q", value)
		}
		addresses = append(addresses, address)
	}
	return addresses, nil
}

func trafficSettings(policy apiclient.MachineTrafficPolicy) (state.TrafficSettings, error) {
	upload, err := bandwidthKbps("upload", policy.UploadBandwidthLimitMbps)
	if err != nil {
		return state.TrafficSettings{}, err
	}
	download, err := bandwidthKbps("download", policy.DownloadBandwidthLimitMbps)
	if err != nil {
		return state.TrafficSettings{}, err
	}
	var household int64
	if policy.HostUploadLimitMbps != nil {
		if household, err = bandwidthKbps("household upload", *policy.HostUploadLimitMbps); err != nil {
			return state.TrafficSettings{}, err
		}
	}
	counts := []int{policy.BurstMib, policy.PacketsPerSecond, policy.NewConnectionsPerSecond, policy.MaxConnections}
	if slices.ContainsFunc(counts, func(count int) bool { return count < 0 || count > math.MaxUint32 }) {
		return state.TrafficSettings{}, fmt.Errorf("the traffic policy has an out-of-range count in %v", counts)
	}
	enforcement := policy.Enforcement
	if !enforcement.Valid() {
		return state.TrafficSettings{}, fmt.Errorf("unknown traffic enforcement mode %q", enforcement)
	}
	return state.TrafficSettings{
		UploadKbps: upload, DownloadKbps: download, HostUploadKbps: household,
		BurstMiB:                int64(policy.BurstMib),
		PacketsPerSecond:        uint32(policy.PacketsPerSecond),
		NewConnectionsPerSecond: uint32(policy.NewConnectionsPerSecond),
		MaxConnections:          uint32(policy.MaxConnections),
		Enforce:                 enforcement == apiclient.AbuseEnforcementModeEnforce,
	}, nil
}

func bandwidthKbps(direction string, megabits int) (int64, error) {
	if megabits == 0 {
		return 0, nil
	}
	kilobits := int64(megabits) * kilobitsPerMegabit
	bitsPerSecond := uint64(kilobits) * bitsPerKilobit
	if megabits < 0 || bitsPerSecond < network.MinimumBandwidthBPS || bitsPerSecond > network.MaximumBandwidthBPS {
		return 0, fmt.Errorf("the %s limit %d Mbps is outside %d to %d bps",
			direction, megabits, network.MinimumBandwidthBPS, network.MaximumBandwidthBPS)
	}
	return kilobits, nil
}

func optionalCount(value *int) *int64 {
	if value == nil {
		return nil
	}
	count := int64(*value)
	return &count
}
