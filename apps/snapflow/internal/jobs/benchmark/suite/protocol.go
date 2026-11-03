// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"crypto/sha256"
	"encoding/binary"
	"strconv"
)

const (
	SuiteVersion         = 2
	Domain               = "snapflow-machine-benchmark-v1"
	NonceBytes           = 32
	DigestBytes          = sha256.Size
	StreamBlockBytes     = mebibyte
	CPUSegmentIterations = 65_536
	CPUSampleCount       = 48
	GEMMSampleCount      = 8
	GEMMDimension        = 4_096
	GEMMElementBytes     = 4
	gemmElementMask      = 0x07
	gemmElementOffset    = 4
	labelSeparator       = 0x00
	indexSeparator       = "/"
	uint32Bytes          = 4
	uint64Bytes          = 8
	kibibyte             = 1 << 10
	mebibyte             = 1 << 20
	gibibyte             = 1 << 30
)

const (
	LabelCPU            = "cpu"
	LabelCPUSeed        = "cpu-seed"
	LabelMemory         = "memory"
	LabelMemoryOrder    = "memory-order"
	LabelDisk           = "disk"
	LabelGEMM           = "gemm"
	LabelGEMMLeft       = "gemm-a"
	LabelGEMMRight      = "gemm-b"
	LabelStream         = "stream"
	LabelSample         = "sample"
	LabelSpeedtestToken = "speedtest-token"
)

func LabelledDigest(label string, parts ...[]byte) [DigestBytes]byte {
	hash := sha256.New()
	hash.Write([]byte(Domain))
	hash.Write([]byte{labelSeparator})
	hash.Write([]byte(label))
	hash.Write([]byte{labelSeparator})
	for _, part := range parts {
		hash.Write(part)
	}
	var digest [DigestBytes]byte
	hash.Sum(digest[:0])
	return digest
}

func IndexedLabel(label string, index int) string {
	return label + indexSeparator + strconv.Itoa(index)
}

func StreamKey(nonce []byte, label string) [DigestBytes]byte {
	return LabelledDigest(LabelStream+indexSeparator+label, nonce)
}

func CPUThreadSeed(nonce []byte, thread int) [DigestBytes]byte {
	return LabelledDigest(LabelCPUSeed, nonce, uint32BigEndian(uint32(thread)))
}

func SampleIndices(nonce []byte, label string, root []byte, leafCount uint64, count int) []uint64 {
	seed := LabelledDigest(LabelSample+indexSeparator+label, nonce, root, uint64BigEndian(leafCount))
	indices := make([]uint64, count)
	for sample := range indices {
		digest := sha256.Sum256(append(seed[:], uint32BigEndian(uint32(sample))...))
		indices[sample] = binary.BigEndian.Uint64(digest[:uint64Bytes]) % leafCount
	}
	return indices
}

func uint32BigEndian(value uint32) []byte {
	return binary.BigEndian.AppendUint32(make([]byte, 0, uint32Bytes), value)
}

func uint64BigEndian(value uint64) []byte {
	return binary.BigEndian.AppendUint64(make([]byte, 0, uint64Bytes), value)
}
