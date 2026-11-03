// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admit

import (
	"errors"
	"time"
)

const (
	maximumHTTPRequests    = 20_000
	maximumHTTPConnections = 50_000
	maximumHTTPStreams     = 4_000
	maximumTCPConnections  = 100_000
	maximumUDPFlows        = 100_000
)

const (
	productionHTTPPerSourceRate              = 100
	productionHTTPPerSourceBurst             = 200
	productionHTTPGlobalRate                 = 10_000
	productionHTTPGlobalBurst                = 20_000
	productionHTTPSourceEntries              = 65_536
	productionHTTPRequestsPerSource          = 500
	productionHTTPRequestsPerOwner           = 4_000
	productionHTTPRequestsPerRoute           = 2_000
	productionHTTPRequestsPerBinding         = 4_000
	productionHTTPRequestsInteractiveReserve = 400
	productionHTTPConnectionsPerSource       = 2_000
	productionHTTPStreamsPerSource           = 50
	productionHTTPStreamsPerOwner            = 1_000
	productionHTTPStreamsPerRoute            = 500
	productionHTTPStreamsPerBinding          = 1_000
	productionHTTPStreamsInteractiveReserve  = 400
	productionTCPPerSourceRate               = 200
	productionTCPPerSourceBurst              = 400
	productionTCPGlobalRate                  = 20_000
	productionTCPGlobalBurst                 = 40_000
	productionTCPSourceEntries               = 65_536
	productionTCPConnectionsPerSource        = 2_000
	productionTCPConnectionsPerOwner         = 20_000
	productionTCPConnectionsPerRoute         = 10_000
	productionTCPConnectionsPerBinding       = 20_000
	productionUDPPerSourceRate               = 4_000
	productionUDPPerSourceBurst              = 8_000
	productionUDPGlobalRate                  = 1_000_000
	productionUDPGlobalBurst                 = 2_000_000
	productionUDPSourceEntries               = 65_536
	productionUDPFlowsPerSource              = 2_000
	productionUDPFlowsPerOwner               = 20_000
	productionUDPFlowsPerRoute               = 10_000
	productionUDPFlowsPerBinding             = 20_000
	sourceIdleTTL                            = 2 * time.Minute
	pruneInterval                            = time.Minute
)

type Limits struct {
	HTTPPerSourceRate              int
	HTTPPerSourceBurst             int
	HTTPGlobalRate                 int
	HTTPGlobalBurst                int
	HTTPSourceEntries              int
	HTTPRequests                   int
	HTTPRequestsPerSource          int
	HTTPRequestsPerOwner           int
	HTTPRequestsPerRoute           int
	HTTPRequestsPerBinding         int
	HTTPRequestsInteractiveReserve int
	HTTPConnections                int
	HTTPConnectionsPerSource       int
	HTTPStreams                    int
	HTTPStreamsPerSource           int
	HTTPStreamsPerOwner            int
	HTTPStreamsPerRoute            int
	HTTPStreamsPerBinding          int
	HTTPStreamsInteractiveReserve  int
	TCPPerSourceRate               int
	TCPPerSourceBurst              int
	TCPGlobalRate                  int
	TCPGlobalBurst                 int
	TCPSourceEntries               int
	TCPConnections                 int
	TCPPerSource                   int
	TCPPerOwner                    int
	TCPPerRoute                    int
	TCPPerBinding                  int
	UDPPerSourceRate               int
	UDPPerSourceBurst              int
	UDPGlobalRate                  int
	UDPGlobalBurst                 int
	UDPSourceEntries               int
	UDPFlows                       int
	UDPFlowsPerSource              int
	UDPFlowsPerOwner               int
	UDPFlowsPerRoute               int
	UDPFlowsPerBinding             int
}

func ProductionLimits() Limits {
	return Limits{
		HTTPPerSourceRate:              productionHTTPPerSourceRate,
		HTTPPerSourceBurst:             productionHTTPPerSourceBurst,
		HTTPGlobalRate:                 productionHTTPGlobalRate,
		HTTPGlobalBurst:                productionHTTPGlobalBurst,
		HTTPSourceEntries:              productionHTTPSourceEntries,
		HTTPRequests:                   maximumHTTPRequests,
		HTTPRequestsPerSource:          productionHTTPRequestsPerSource,
		HTTPRequestsPerOwner:           productionHTTPRequestsPerOwner,
		HTTPRequestsPerRoute:           productionHTTPRequestsPerRoute,
		HTTPRequestsPerBinding:         productionHTTPRequestsPerBinding,
		HTTPRequestsInteractiveReserve: productionHTTPRequestsInteractiveReserve,
		HTTPConnections:                maximumHTTPConnections,
		HTTPConnectionsPerSource:       productionHTTPConnectionsPerSource,
		HTTPStreams:                    maximumHTTPStreams,
		HTTPStreamsPerSource:           productionHTTPStreamsPerSource,
		HTTPStreamsPerOwner:            productionHTTPStreamsPerOwner,
		HTTPStreamsPerRoute:            productionHTTPStreamsPerRoute,
		HTTPStreamsPerBinding:          productionHTTPStreamsPerBinding,
		HTTPStreamsInteractiveReserve:  productionHTTPStreamsInteractiveReserve,
		TCPPerSourceRate:               productionTCPPerSourceRate,
		TCPPerSourceBurst:              productionTCPPerSourceBurst,
		TCPGlobalRate:                  productionTCPGlobalRate,
		TCPGlobalBurst:                 productionTCPGlobalBurst,
		TCPSourceEntries:               productionTCPSourceEntries,
		TCPConnections:                 maximumTCPConnections,
		TCPPerSource:                   productionTCPConnectionsPerSource,
		TCPPerOwner:                    productionTCPConnectionsPerOwner,
		TCPPerRoute:                    productionTCPConnectionsPerRoute,
		TCPPerBinding:                  productionTCPConnectionsPerBinding,
		UDPPerSourceRate:               productionUDPPerSourceRate,
		UDPPerSourceBurst:              productionUDPPerSourceBurst,
		UDPGlobalRate:                  productionUDPGlobalRate,
		UDPGlobalBurst:                 productionUDPGlobalBurst,
		UDPSourceEntries:               productionUDPSourceEntries,
		UDPFlows:                       maximumUDPFlows,
		UDPFlowsPerSource:              productionUDPFlowsPerSource,
		UDPFlowsPerOwner:               productionUDPFlowsPerOwner,
		UDPFlowsPerRoute:               productionUDPFlowsPerRoute,
		UDPFlowsPerBinding:             productionUDPFlowsPerBinding,
	}
}

func (limits Limits) validate() error {
	values := [...]int{
		limits.HTTPPerSourceRate, limits.HTTPPerSourceBurst,
		limits.HTTPGlobalRate, limits.HTTPGlobalBurst,
		limits.HTTPSourceEntries, limits.HTTPRequests,
		limits.HTTPRequestsPerSource, limits.HTTPRequestsPerOwner,
		limits.HTTPRequestsPerRoute, limits.HTTPRequestsPerBinding,
		limits.HTTPConnections, limits.HTTPConnectionsPerSource,
		limits.HTTPStreams,
		limits.HTTPStreamsPerSource, limits.HTTPStreamsPerOwner,
		limits.HTTPStreamsPerRoute, limits.HTTPStreamsPerBinding,
		limits.TCPPerSourceRate, limits.TCPPerSourceBurst,
		limits.TCPGlobalRate, limits.TCPGlobalBurst, limits.TCPSourceEntries,
		limits.TCPConnections, limits.TCPPerSource, limits.TCPPerOwner,
		limits.TCPPerRoute, limits.TCPPerBinding,
		limits.UDPPerSourceRate, limits.UDPPerSourceBurst,
		limits.UDPGlobalRate, limits.UDPGlobalBurst, limits.UDPSourceEntries,
		limits.UDPFlows, limits.UDPFlowsPerSource,
		limits.UDPFlowsPerOwner, limits.UDPFlowsPerRoute,
		limits.UDPFlowsPerBinding,
	}
	for _, value := range values {
		if value < 1 {
			return errors.New("admission limits must be positive")
		}
	}
	if limits.HTTPPerSourceBurst < limits.HTTPPerSourceRate ||
		limits.HTTPGlobalBurst < limits.HTTPGlobalRate ||
		limits.TCPPerSourceBurst < limits.TCPPerSourceRate ||
		limits.TCPGlobalBurst < limits.TCPGlobalRate ||
		limits.UDPPerSourceBurst < limits.UDPPerSourceRate ||
		limits.UDPGlobalBurst < limits.UDPGlobalRate {
		return errors.New("admission bursts must be at least their rates")
	}
	if limits.HTTPRequestsInteractiveReserve < 0 ||
		limits.HTTPRequestsInteractiveReserve >= limits.HTTPRequests ||
		limits.HTTPStreamsInteractiveReserve < 0 ||
		limits.HTTPStreamsInteractiveReserve >= limits.HTTPStreams {
		return errors.New("interactive admission reserve must be smaller than its global limit")
	}
	return nil
}
