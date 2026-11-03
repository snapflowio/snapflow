// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"errors"
	"strconv"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	leadingZero  = '0'
	positiveBits = 63
)

func validateSample(sample apiclient.EdgeUsageSampleDto) error {
	if sample.BackendId == uuid.Nil {
		return errors.New("backend ID is invalid")
	}
	if sample.AssignmentGeneration < 1 {
		return errors.New("assignment generation is invalid")
	}
	if sample.Protocol != apiclient.NetworkProtocolHttp &&
		sample.Protocol != apiclient.NetworkProtocolTcp &&
		sample.Protocol != apiclient.NetworkProtocolUdp {
		return errors.New("network protocol is invalid")
	}
	for _, counter := range [...]string{
		sample.BytesIn,
		sample.BytesOut,
		sample.PacketsIn,
		sample.PacketsOut,
	} {
		if err := validateCounter(counter); err != nil {
			return err
		}
	}
	if sample.TcpConnections < 0 || sample.UdpFlows < 0 {
		return errors.New("connection and flow counters must be nonnegative")
	}
	return nil
}

func parseSequence(value string) (uint64, error) {
	if value == "" || len(value) > 1 && value[0] == leadingZero {
		return 0, errors.New("edge usage sequence format is invalid")
	}
	sequence, err := strconv.ParseUint(value, decimalBase, positiveBits)
	if err != nil || sequence == 0 {
		return 0, errors.New("edge usage sequence is invalid")
	}
	return sequence, nil
}

func validateCounter(value string) error {
	if value == "" || len(value) > 1 && value[0] == leadingZero {
		return errors.New("usage counter format is invalid")
	}
	parsed, err := strconv.ParseUint(value, decimalBase, positiveBits)
	if err != nil || strconv.FormatUint(parsed, decimalBase) != value {
		return errors.New("usage counter is invalid")
	}
	return nil
}
