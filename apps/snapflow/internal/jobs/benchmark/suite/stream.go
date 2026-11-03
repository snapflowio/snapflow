// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"encoding/binary"
	"fmt"

	"golang.org/x/crypto/chacha20"
)

const streamNonceIndexOffset = chacha20.NonceSize - uint64Bytes

func FillStreamBlock(key [DigestBytes]byte, index uint64, destination []byte) error {
	var nonce [chacha20.NonceSize]byte
	binary.BigEndian.PutUint64(nonce[streamNonceIndexOffset:], index)
	cipher, err := chacha20.NewUnauthenticatedCipher(key[:], nonce[:])
	if err != nil {
		return fmt.Errorf("initialize benchmark stream block %d: %w", index, err)
	}
	clear(destination)
	cipher.XORKeyStream(destination, destination)
	return nil
}
