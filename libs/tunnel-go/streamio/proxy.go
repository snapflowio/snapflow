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

package streamio

import (
	"errors"
	"io"
	"sync"
)

const proxyDirections = 2

type ProxyStats struct {
	LeftToRightBytes uint64
	RightToLeftBytes uint64
}

func WriteAll(writer io.Writer, payload []byte) error {
	for len(payload) > 0 {
		written, err := writer.Write(payload)
		if err != nil {
			return err
		}
		if written == 0 {
			return io.ErrShortWrite
		}
		payload = payload[written:]
	}
	return nil
}

func ProxyBidirectional(left, right io.ReadWriteCloser) error {
	_, err := ProxyBidirectionalCounted(left, right)
	return err
}

func ProxyBidirectionalCounted(
	left,
	right io.ReadWriteCloser,
) (ProxyStats, error) {
	type copyResult struct {
		leftToRight bool
		bytes       int64
		err         error
	}
	results := make(chan copyResult, proxyDirections)
	copyOneWay := func(
		destination io.WriteCloser,
		source io.Reader,
		leftToRight bool,
	) {
		copied, copyErr := io.Copy(destination, source)
		if closer, ok := destination.(interface{ CloseWrite() error }); ok {
			results <- copyResult{
				leftToRight: leftToRight,
				bytes:       copied,
				err:         errors.Join(copyErr, closer.CloseWrite()),
			}
			return
		}
		results <- copyResult{
			leftToRight: leftToRight,
			bytes:       copied,
			err:         errors.Join(copyErr, destination.Close()),
		}
	}
	var group sync.WaitGroup
	group.Add(proxyDirections)
	go func() {
		defer group.Done()
		copyOneWay(left, right, false)
	}()
	go func() {
		defer group.Done()
		copyOneWay(right, left, true)
	}()
	first := <-results
	var forcedCloseErr error
	if first.err != nil {
		forcedCloseErr = errors.Join(left.Close(), right.Close())
	}
	group.Wait()
	close(results)
	var stats ProxyStats
	result := forcedCloseErr
	accumulate := func(copied copyResult) {
		if copied.leftToRight {
			stats.LeftToRightBytes += uint64(copied.bytes)
		} else {
			stats.RightToLeftBytes += uint64(copied.bytes)
		}
		result = errors.Join(result, copied.err)
	}
	accumulate(first)
	for copied := range results {
		accumulate(copied)
	}
	return stats, result
}
