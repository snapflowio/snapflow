// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"crypto/sha256"
	"errors"
	"fmt"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	merkleArity      = 2
	merkleLeafPrefix = 0x00
	merkleNodePrefix = 0x01
)

type merkleTree struct {
	levels [][][DigestBytes]byte
}

type leafSource func(index uint64) ([]byte, error)

func MerkleLeafHash(leaf []byte) [DigestBytes]byte {
	hash := sha256.New()
	hash.Write([]byte{merkleLeafPrefix})
	hash.Write(leaf)
	var digest [DigestBytes]byte
	hash.Sum(digest[:0])
	return digest
}

func MerkleNodeHash(left, right [DigestBytes]byte) [DigestBytes]byte {
	hash := sha256.New()
	hash.Write([]byte{merkleNodePrefix})
	hash.Write(left[:])
	hash.Write(right[:])
	var digest [DigestBytes]byte
	hash.Sum(digest[:0])
	return digest
}

func newMerkleTree(leafHashes [][DigestBytes]byte) (*merkleTree, error) {
	if len(leafHashes) == 0 {
		return nil, errors.New("a benchmark Merkle tree needs at least one leaf")
	}
	levels := [][][DigestBytes]byte{leafHashes}
	for current := leafHashes; len(current) > 1; {
		next := make([][DigestBytes]byte, 0, (len(current)+merkleArity-1)/merkleArity)
		for index := 0; index < len(current); index += merkleArity {
			if index+1 == len(current) {
				next = append(next, current[index])
				continue
			}
			next = append(next, MerkleNodeHash(current[index], current[index+1]))
		}
		levels = append(levels, next)
		current = next
	}
	return &merkleTree{levels: levels}, nil
}

func (tree *merkleTree) root() []byte {
	top := tree.levels[len(tree.levels)-1][0]
	return top[:]
}

func (tree *merkleTree) leafCount() uint64 {
	return uint64(len(tree.levels[0]))
}

func (tree *merkleTree) path(index uint64) [][]byte {
	path := make([][]byte, 0, len(tree.levels))
	position := index
	for _, level := range tree.levels[:len(tree.levels)-1] {
		if sibling := position ^ 1; sibling < uint64(len(level)) {
			hash := level[sibling]
			path = append(path, hash[:])
		}
		position >>= 1
	}
	return path
}

func (tree *merkleTree) samples(nonce []byte, label string, count int, leaf leafSource) ([]*machinev1alpha1.MerkleSample, error) {
	indices := SampleIndices(nonce, label, tree.root(), tree.leafCount(), count)
	samples := make([]*machinev1alpha1.MerkleSample, 0, len(indices))
	for _, index := range indices {
		data, err := leaf(index)
		if err != nil {
			return nil, fmt.Errorf("read %s benchmark leaf %d: %w", label, index, err)
		}
		samples = append(samples, &machinev1alpha1.MerkleSample{Index: index, Leaf: data, Path: tree.path(index)})
	}
	return samples, nil
}

func leafHashes(leaves [][]byte) [][DigestBytes]byte {
	hashes := make([][DigestBytes]byte, len(leaves))
	for index, leaf := range leaves {
		hashes[index] = MerkleLeafHash(leaf)
	}
	return hashes
}
