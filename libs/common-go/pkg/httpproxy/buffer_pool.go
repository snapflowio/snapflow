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

package httpproxy

import (
	"net/http/httputil"
	"sync"
)

const responseBufferSize = 32 << 10

type bufferPool struct {
	pool sync.Pool
}

func NewResponseBufferPool() httputil.BufferPool {
	return &bufferPool{}
}

func (pool *bufferPool) Get() []byte {
	if buffer, pooled := pool.pool.Get().(*[]byte); pooled {
		return *buffer
	}
	return make([]byte, responseBufferSize)
}

func (pool *bufferPool) Put(buffer []byte) {
	if cap(buffer) < responseBufferSize {
		return
	}
	buffer = buffer[:responseBufferSize]
	pool.pool.Put(&buffer)
}
