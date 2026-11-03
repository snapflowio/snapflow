// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/klauspost/compress/zstd"
)

const (
	cpuKernelConcurrency        = 1
	allMatches                  = -1
	flopsPerMatrixMultiplyAdd   = 2
	zstdReferenceBytesPerSec    = 205_000_000
	jsonReferenceBytesPerSec    = 184_000_000
	regexpReferenceBytesPerSec  = 34_350_000
	sortReferenceElementsPerSec = 21_650_000
	matrixReferenceFlopsPerSec  = 8_730_000_000
)

type cpuKernel struct {
	reference float64
	run       func(*cpuWorker) (uint64, error)
}

// cpuKernels lists the scored kernels in their fixed scoring order.
func cpuKernels() []cpuKernel {
	return []cpuKernel{
		{reference: zstdReferenceBytesPerSec, run: (*cpuWorker).compress},
		{reference: jsonReferenceBytesPerSec, run: (*cpuWorker).serialize},
		{reference: regexpReferenceBytesPerSec, run: (*cpuWorker).match},
		{reference: sortReferenceElementsPerSec, run: (*cpuWorker).sort},
		{reference: matrixReferenceFlopsPerSec, run: (*cpuWorker).multiply},
	}
}

type cpuWorker struct {
	corpus       *cpuCorpus
	encoder      *zstd.Encoder
	decoder      *zstd.Decoder
	compressed   []byte
	decompressed []byte
	numbers      []uint64
	product      []float64
}

func newCPUWorker(corpus *cpuCorpus) (*cpuWorker, error) {
	encoder, err := zstd.NewWriter(nil, zstd.WithEncoderConcurrency(cpuKernelConcurrency))
	if err != nil {
		return nil, fmt.Errorf("create the CPU benchmark zstd encoder: %w", err)
	}
	decoder, err := zstd.NewReader(nil, zstd.WithDecoderConcurrency(cpuKernelConcurrency))
	if err != nil {
		return nil, fmt.Errorf("create the CPU benchmark zstd decoder: %w", err)
	}
	return &cpuWorker{
		corpus: corpus, encoder: encoder, decoder: decoder,
		numbers: make([]uint64, len(corpus.numbers)), product: make([]float64, len(corpus.left)),
	}, nil
}

func (worker *cpuWorker) close() {
	worker.decoder.Close()
}

func (worker *cpuWorker) compress() (uint64, error) {
	worker.compressed = worker.encoder.EncodeAll(worker.corpus.text, worker.compressed[:0])
	decompressed, err := worker.decoder.DecodeAll(worker.compressed, worker.decompressed[:0])
	if err != nil {
		return 0, fmt.Errorf("decompress the CPU benchmark text: %w", err)
	}
	worker.decompressed = decompressed
	if len(decompressed) != len(worker.corpus.text) {
		return 0, errors.New("the CPU benchmark text did not decompress to its original length")
	}
	return uint64(len(decompressed)), nil
}

func (worker *cpuWorker) serialize() (uint64, error) {
	encoded, err := json.Marshal(worker.corpus.records)
	if err != nil {
		return 0, fmt.Errorf("encode the CPU benchmark records: %w", err)
	}
	var decoded []cpuRecord
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return 0, fmt.Errorf("decode the CPU benchmark records: %w", err)
	}
	if len(decoded) != len(worker.corpus.records) {
		return 0, errors.New("the CPU benchmark records did not decode to their original count")
	}
	return uint64(len(encoded)), nil
}

func (worker *cpuWorker) match() (uint64, error) {
	if len(worker.corpus.pattern.FindAllIndex(worker.corpus.text, allMatches)) == 0 {
		return 0, errors.New("the CPU benchmark pattern matched nothing")
	}
	return uint64(len(worker.corpus.text)), nil
}

func (worker *cpuWorker) sort() (uint64, error) {
	copy(worker.numbers, worker.corpus.numbers)
	slices.Sort(worker.numbers)
	return uint64(len(worker.numbers)), nil
}

func (worker *cpuWorker) multiply() (uint64, error) {
	left, right, product := worker.corpus.left, worker.corpus.right, worker.product
	clear(product)
	for row := range cpuMatrixDimension {
		output := product[row*cpuMatrixDimension : (row+1)*cpuMatrixDimension]
		for inner := range cpuMatrixDimension {
			factor := left[row*cpuMatrixDimension+inner]
			input := right[inner*cpuMatrixDimension : (inner+1)*cpuMatrixDimension]
			for column := range output {
				output[column] += factor * input[column]
			}
		}
	}
	return flopsPerMatrixMultiplyAdd * cpuMatrixDimension * cpuMatrixDimension * cpuMatrixDimension, nil
}
