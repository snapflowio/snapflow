// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"bytes"
	"encoding/binary"
	"math"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

type leafCheck func(index uint64, leaf []byte) bool

func verifyInclusion(index, size uint64, leaf []byte, path [][]byte, root []byte) bool {
	if index >= size || len(root) != DigestBytes {
		return false
	}
	last := size - 1
	hash := MerkleLeafHash(leaf)
	for _, element := range path {
		if last == 0 || len(element) != DigestBytes {
			return false
		}
		sibling := [DigestBytes]byte(element)
		if index&1 == 1 || index == last {
			hash = MerkleNodeHash(sibling, hash)
			for index&1 == 0 && index != 0 {
				index >>= 1
				last >>= 1
			}
		} else {
			hash = MerkleNodeHash(hash, sibling)
		}
		index >>= 1
		last >>= 1
	}
	return last == 0 && bytes.Equal(hash[:], root)
}

func verifySampled(nonce []byte, label string, root []byte, leafCount uint64, samples []*machinev1alpha1.MerkleSample, count int, valid leafCheck) bool {
	if leafCount == 0 || len(samples) != count {
		return false
	}
	expected := SampleIndices(nonce, label, root, leafCount, count)
	for position, sample := range samples {
		if sample.GetIndex() != expected[position] || !valid(sample.GetIndex(), sample.GetLeaf()) ||
			!verifyInclusion(sample.GetIndex(), leafCount, sample.GetLeaf(), sample.GetPath(), root) {
			return false
		}
	}
	return true
}

func verifyCPU(nonce []byte, cpu *machinev1alpha1.CpuMeasurement) bool {
	if cpu.GetIterationsPerThread() == 0 || cpu.GetIterationsPerThread()%CPUSegmentIterations != 0 || cpu.GetThreads() == 0 {
		return false
	}
	segments := cpu.GetIterationsPerThread() / CPUSegmentIterations
	return verifySampled(nonce, LabelCPU, cpu.GetRoot(), segments*uint64(cpu.GetThreads()), cpu.GetSamples(), CPUSampleCount,
		func(index uint64, leaf []byte) bool {
			if len(leaf) != cpuLeafBytes {
				return false
			}
			start := [DigestBytes]byte(leaf[:DigestBytes])
			if index%segments == 0 && start != CPUThreadSeed(nonce, int(index/segments)) {
				return false
			}
			end := HashChain(start, CPUSegmentIterations)
			return bytes.Equal(end[:], leaf[DigestBytes:])
		})
}

func verifyGEMM(nonce []byte, gpu, dimension int, proof GEMMProof, tolerance float64) bool {
	leftKey, rightKey := GEMMKeys(nonce, gpu)
	right, err := GEMMMatrix(rightKey, dimension)
	if err != nil {
		return false
	}
	return verifySampled(nonce, IndexedLabel(LabelGEMM, gpu), proof.Root, uint64(dimension), proof.Samples, GEMMSampleCount,
		func(index uint64, leaf []byte) bool {
			left, err := GEMMMatrix(leftKey, dimension)
			if err != nil || len(leaf) != dimension*GEMMElementBytes {
				return false
			}
			expected := referenceProductRow(left[int(index)*dimension:int(index+1)*dimension], right, dimension)
			for column, value := range expected {
				actual := math.Float32frombits(binary.LittleEndian.Uint32(leaf[column*GEMMElementBytes:]))
				if math.Abs(float64(actual)-float64(value)) > tolerance {
					return false
				}
			}
			return true
		})
}

func referenceProductRow(left, right []byte, dimension int) []int32 {
	product := make([]int32, dimension)
	for inner, factor := range left {
		for column := range product {
			product[column] += int32(int8(factor)) * int32(int8(right[inner*dimension+column]))
		}
	}
	return product
}

func referenceProductRows(left, right []byte, dimension int) [][]byte {
	rows := make([][]byte, dimension)
	for row := range rows {
		values := referenceProductRow(left[row*dimension:(row+1)*dimension], right, dimension)
		encoded := make([]byte, 0, dimension*GEMMElementBytes)
		for _, value := range values {
			encoded = binary.LittleEndian.AppendUint32(encoded, math.Float32bits(float32(value)))
		}
		rows[row] = encoded
	}
	return rows
}
