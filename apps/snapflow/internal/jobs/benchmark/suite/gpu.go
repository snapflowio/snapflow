// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"fmt"
	"io/fs"
	"math"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const mebibytesPerGibibyte = 1024

type GPUConfig struct {
	System           fs.FS
	Helper           string
	VRAMReserveBytes uint64
	GEMMDimension    int
	GEMM             WindowedPhase
}

func MeasureGPUs(ctx context.Context, nonce []byte, cfg GPUConfig) ([]*machinev1alpha1.GpuMeasurement, error) {
	devices, err := enumerateGPUs(cfg.System)
	if err != nil || len(devices) == 0 {
		return nil, err
	}
	reported, err := queryNVIDIA(ctx)
	if err != nil {
		return nil, err
	}
	measurements := make([]*machinev1alpha1.GpuMeasurement, 0, len(devices))
	for index, device := range devices {
		details, found := reported[device.address]
		if !found {
			return nil, fmt.Errorf("nvidia-smi does not report the GPU at %s", device.address)
		}
		measurement, err := measureGPU(ctx, nonce, cfg, index, device, details)
		if err != nil {
			return nil, err
		}
		measurements = append(measurements, measurement)
	}
	return measurements, nil
}

func measureGPU(ctx context.Context, nonce []byte, cfg GPUConfig, index int, device pciGPU, details nvidiaGPU) (*machinev1alpha1.GpuMeasurement, error) {
	vram, err := measureVRAM(ctx, cfg.Helper, index, cfg.VRAMReserveBytes)
	if err != nil {
		return nil, err
	}
	gemm, err := measureGEMM(ctx, nonce, cfg, index)
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.GpuMeasurement{
		PciDeviceId:          device.deviceID,
		Uuid:                 details.uuid,
		MemoryGib:            uint32(math.Round(float64(details.totalMiB) / mebibytesPerGibibyte)),
		VramBytes:            vram,
		GemmRoot:             gemm.Root,
		GemmSamples:          gemm.Samples,
		Tflops:               gemm.TFLOPS,
		PcieCurrentSpeedMts:  device.link.currentSpeedMTs,
		PcieMaxSpeedMts:      device.link.maxSpeedMTs,
		PcieCurrentWidth:     device.link.currentWidth,
		PcieMaxWidth:         device.link.maxWidth,
		UncorrectedEccErrors: details.uncorrectedECCErrors,
		RetiredPagesPending:  details.retiredPagesPending,
	}, nil
}
