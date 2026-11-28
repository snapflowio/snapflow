// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package netrules

import (
	"errors"
	"fmt"

	"github.com/google/nftables"
	"github.com/mdlayher/netlink"
)

const (
	acknowledgementBufferBytes = 4096
	hostNamespace              = -1
)

type rulesetBatch struct {
	connection *nftables.Conn
	messages   int
	failures   []error
}

func newRulesetBatch(namespaceFd int) (*rulesetBatch, error) {
	batch := &rulesetBatch{}
	options := []nftables.ConnOption{nftables.WithSockOptions(batch.reserveAcknowledgements)}
	if namespaceFd != hostNamespace {
		options = append(options, nftables.WithNetNSFd(namespaceFd))
	}
	connection, err := nftables.New(options...)
	if err != nil {
		return nil, fmt.Errorf("initialize nftables netlink client: %w", err)
	}
	batch.connection = connection
	return batch, nil
}

func (batch *rulesetBatch) reserveAcknowledgements(connection *netlink.Conn) error {
	if err := connection.SetReadBuffer(batch.receiveBufferBytes()); err != nil {
		return fmt.Errorf("reserve nftables acknowledgement buffer: %w", err)
	}
	return nil
}

func (batch *rulesetBatch) receiveBufferBytes() int {
	return batch.messages * acknowledgementBufferBytes
}

func (batch *rulesetBatch) delTable(table *nftables.Table) {
	batch.messages++
	batch.connection.DelTable(table)
}

func (batch *rulesetBatch) addTable(table *nftables.Table) *nftables.Table {
	batch.messages++
	return batch.connection.AddTable(table)
}

func (batch *rulesetBatch) addChain(chain *nftables.Chain) *nftables.Chain {
	batch.messages++
	return batch.connection.AddChain(chain)
}

func (batch *rulesetBatch) addRule(rule *nftables.Rule) {
	batch.messages++
	batch.connection.AddRule(rule)
}

func (batch *rulesetBatch) flushChain(chain *nftables.Chain) {
	batch.messages++
	batch.connection.FlushChain(chain)
}

func (batch *rulesetBatch) addObject(object nftables.Obj) {
	batch.messages++
	batch.connection.AddObj(object)
}

func (batch *rulesetBatch) addSet(set *nftables.Set, elements []nftables.SetElement) *nftables.Set {
	batch.messages++
	if err := batch.connection.AddSet(set, elements); err != nil {
		batch.failures = append(batch.failures, fmt.Errorf("add set %s: %w", set.Name, err))
	}
	return set
}

func (batch *rulesetBatch) replaceSetElements(set *nftables.Set, elements []nftables.SetElement) {
	batch.messages++
	batch.connection.FlushSet(set)
	if len(elements) == 0 {
		return
	}
	batch.messages++
	if err := batch.connection.SetAddElements(set, elements); err != nil {
		batch.failures = append(batch.failures, fmt.Errorf("fill set %s: %w", set.Name, err))
	}
}

func (batch *rulesetBatch) flush() error {
	if len(batch.failures) > 0 {
		return errors.Join(batch.failures...)
	}
	return batch.connection.Flush()
}
