// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package abuse

import "time"

const (
	Window = 30 * time.Second

	horizontalScanDestinations   = 256
	verticalScanPorts            = 100
	failedConnectionRatio        = 0.5
	failedConnectionsPerMinute   = 200
	massSMTPAttempts             = 100
	floodDropsPerWindow          = 100
	packetFloodDropsPerWindow    = 1000
	sustainedWindows             = 2
	reflectionAttemptsPerWindow  = 50
	miningCPUUtilization         = 0.95
	miningCPUDeviation           = 0.03
	miningProfileWindows         = 10
	miningMaximumTrafficBytes    = 64 * 1024
	miningMinimumPortFlows       = 1
	proxyDistinctDomains         = 300
	proxyMinimumHourlyBytes      = 100 * 1024 * 1024
	proxyBalanceLow              = 0.5
	proxyBalanceHigh             = 2.0
	proxyMaximumHostIngressShare = 0.1
	proxyHistoryWindows          = int(time.Hour / Window)
	secondsPerMinute             = 60
	percentScale                 = 100
)
