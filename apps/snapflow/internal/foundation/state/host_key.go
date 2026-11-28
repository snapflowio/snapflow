// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"crypto/ecdsa"
	"errors"
	"fmt"
	"log/slog"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/accounts/abi/bind/v2"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

const legacyRecoveryOffset = 27

type HostKey struct {
	key     *ecdsa.PrivateKey
	address common.Address
}

func GenerateHostKey() (*HostKey, error) {
	key, err := crypto.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("generate machine host key: %w", err)
	}
	return NewHostKey(key)
}

func NewHostKey(key *ecdsa.PrivateKey) (*HostKey, error) {
	if key == nil {
		return nil, errors.New("machine host key is required")
	}
	return &HostKey{key: key, address: crypto.PubkeyToAddress(key.PublicKey)}, nil
}

func decodeHostKey(encoded string) (*HostKey, error) {
	raw, err := hexutil.Decode(encoded)
	if err != nil {
		return nil, errors.New("machine identity contains an invalid host key encoding")
	}
	key, err := crypto.ToECDSA(raw)
	if err != nil {
		return nil, fmt.Errorf("machine identity contains an invalid host key: %w", err)
	}
	return NewHostKey(key)
}

func (host *HostKey) encode() string {
	return hexutil.Encode(crypto.FromECDSA(host.key))
}

func (host *HostKey) Address() common.Address { return host.address }

func (host *HostKey) String() string { return host.address.Hex() }

func (host *HostKey) LogValue() slog.Value { return slog.StringValue(host.address.Hex()) }

func (host *HostKey) SignDigest(digest common.Hash) ([]byte, error) {
	signature, err := crypto.Sign(digest.Bytes(), host.key)
	if err != nil {
		return nil, fmt.Errorf("sign with the machine host key: %w", err)
	}
	signature[crypto.RecoveryIDOffset] += legacyRecoveryOffset
	return signature, nil
}

func (host *HostKey) SignMessage(message []byte) ([]byte, error) {
	return host.SignDigest(common.BytesToHash(accounts.TextHash(message)))
}

func (host *HostKey) Transactor(chainID *big.Int) *bind.TransactOpts {
	return bind.NewKeyedTransactor(host.key, chainID)
}
