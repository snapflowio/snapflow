// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

const (
	nvidiaSMI          = "nvidia-smi"
	nvidiaSMIQuery     = "--query-gpu=pci.bus_id,uuid,memory.total,ecc.errors.uncorrected.volatile.total,retired_pages.pending"
	nvidiaSMIFormat    = "--format=csv,noheader,nounits"
	nvidiaSMIFields    = 5
	nvidiaSMISeparator = ","
	nvidiaSMIYes       = "Yes"
	nvidiaSMIBrackets  = "[]"
)

// GPUs without ECC or page retirement (consumer boards, Ampere and later row
// remapping) report these instead of a value; they count as zero errors and nothing pending.
const (
	nvidiaSMINotAvailable = "N/A"
	nvidiaSMINotSupported = "Not Supported"
)

const (
	nvidiaFieldAddress = iota
	nvidiaFieldUUID
	nvidiaFieldTotalMemory
	nvidiaFieldUncorrectedECC
	nvidiaFieldRetiredPending
)

type nvidiaGPU struct {
	uuid                 string
	totalMiB             uint64
	uncorrectedECCErrors uint64
	retiredPagesPending  bool
}

func queryNVIDIA(ctx context.Context) (map[string]nvidiaGPU, error) {
	output, err := exec.CommandContext(ctx, nvidiaSMI, nvidiaSMIQuery, nvidiaSMIFormat).Output()
	if err != nil {
		return nil, fmt.Errorf("query GPUs with nvidia-smi: %w", err)
	}
	return parseNVIDIA(string(output))
}

func parseNVIDIA(output string) (map[string]nvidiaGPU, error) {
	reported := map[string]nvidiaGPU{}
	for line := range strings.Lines(output) {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Split(line, nvidiaSMISeparator)
		if len(fields) != nvidiaSMIFields {
			return nil, fmt.Errorf("unexpected nvidia-smi row %q", strings.TrimSpace(line))
		}
		for index, field := range fields {
			fields[index] = strings.TrimSpace(field)
		}
		total, totalErr := strconv.ParseUint(fields[nvidiaFieldTotalMemory], 10, 64)
		ecc, eccErr := optionalCount(fields[nvidiaFieldUncorrectedECC])
		if err := errors.Join(totalErr, eccErr); err != nil {
			return nil, fmt.Errorf("parse nvidia-smi row %q: %w", strings.TrimSpace(line), err)
		}
		reported[normalizePCIAddress(fields[nvidiaFieldAddress])] = nvidiaGPU{
			uuid: fields[nvidiaFieldUUID], totalMiB: total, uncorrectedECCErrors: ecc,
			retiredPagesPending: fields[nvidiaFieldRetiredPending] == nvidiaSMIYes,
		}
	}
	return reported, nil
}

func optionalCount(value string) (uint64, error) {
	if unwrapped := strings.Trim(value, nvidiaSMIBrackets); unwrapped == nvidiaSMINotAvailable || unwrapped == nvidiaSMINotSupported {
		return 0, nil
	}
	return strconv.ParseUint(value, 10, 64)
}
