// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admit

import (
	"container/list"
	"net/netip"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/time/rate"
)

const (
	sourceBucketShards = 64
	fnvOffset64        = 14_695_981_039_346_656_037
	fnvPrime64         = 1_099_511_628_211
	tokenCost          = 1
)

type protocolRate struct {
	global *rate.Limiter
	source *sourceBucketStore
}

func newProtocolRate(
	sourceEntries int,
	perSourceRate int,
	perSourceBurst int,
	globalRate int,
	globalBurst int,
) *protocolRate {
	return &protocolRate{
		global: rate.NewLimiter(rate.Limit(globalRate), globalBurst),
		source: newSourceBucketStore(sourceEntries, rate.Limit(perSourceRate), perSourceBurst, sourceIdleTTL),
	}
}

func (limit *protocolRate) allow(source netip.Addr, now time.Time) bool {
	return limit.global.AllowN(now, tokenCost) && limit.source.allow(source, now)
}

func (limit *protocolRate) prune(now time.Time) {
	limit.source.prune(now)
}

func (limit *protocolRate) size() int {
	return limit.source.size()
}

func (limit *protocolRate) evictions() uint64 {
	return limit.source.evictions.Load()
}

type sourceBucketStore struct {
	shards    []sourceBucketShard
	rate      rate.Limit
	burst     int
	idleTTL   time.Duration
	evictions atomic.Uint64
}

type sourceBucketShard struct {
	mu       sync.Mutex
	entries  map[netip.Addr]*sourceBucketEntry
	recency  list.List
	capacity int
}

type sourceBucketEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
	element  *list.Element
}

func newSourceBucketStore(
	maxEntries int,
	perSecond rate.Limit,
	burst int,
	idleTTL time.Duration,
) *sourceBucketStore {
	shardCount := min(sourceBucketShards, maxEntries)
	store := &sourceBucketStore{
		shards:  make([]sourceBucketShard, shardCount),
		rate:    perSecond,
		burst:   burst,
		idleTTL: idleTTL,
	}
	baseCapacity := maxEntries / shardCount
	remainder := maxEntries % shardCount
	for index := range store.shards {
		capacity := baseCapacity
		if index < remainder {
			capacity++
		}
		store.shards[index] = sourceBucketShard{
			entries:  make(map[netip.Addr]*sourceBucketEntry, capacity),
			capacity: capacity,
		}
	}
	return store
}

func (store *sourceBucketStore) allow(ip netip.Addr, now time.Time) bool {
	shard := &store.shards[sourceBucketShardIndex(ip, len(store.shards))]
	shard.mu.Lock()
	defer shard.mu.Unlock()
	entry := shard.entries[ip]
	if entry == nil {
		if len(shard.entries) >= shard.capacity && shard.evictOldest() {
			store.evictions.Add(1)
		}
		entry = &sourceBucketEntry{
			limiter: rate.NewLimiter(store.rate, store.burst),
			element: shard.recency.PushFront(ip),
		}
		shard.entries[ip] = entry
	} else {
		shard.recency.MoveToFront(entry.element)
	}
	entry.lastSeen = now
	return entry.limiter.AllowN(now, tokenCost)
}

func (shard *sourceBucketShard) evictOldest() bool {
	oldest := shard.recency.Back()
	if oldest == nil {
		return false
	}
	if oldestIP, valid := oldest.Value.(netip.Addr); valid {
		delete(shard.entries, oldestIP)
	}
	shard.recency.Remove(oldest)
	return true
}

func (store *sourceBucketStore) prune(now time.Time) {
	for index := range store.shards {
		shard := &store.shards[index]
		shard.mu.Lock()
		shard.pruneIdle(now, store.idleTTL)
		shard.mu.Unlock()
	}
}

func (shard *sourceBucketShard) pruneIdle(now time.Time, idleTTL time.Duration) {
	for {
		oldest := shard.recency.Back()
		if oldest == nil {
			return
		}
		ip, valid := oldest.Value.(netip.Addr)
		if !valid {
			shard.recency.Remove(oldest)
			continue
		}
		entry := shard.entries[ip]
		if entry != nil && now.Sub(entry.lastSeen) <= idleTTL {
			return
		}
		delete(shard.entries, ip)
		shard.recency.Remove(oldest)
	}
}

func (store *sourceBucketStore) size() int {
	total := 0
	for index := range store.shards {
		shard := &store.shards[index]
		shard.mu.Lock()
		total += len(shard.entries)
		shard.mu.Unlock()
	}
	return total
}

func sourceBucketShardIndex(ip netip.Addr, shardCount int) int {
	address := ip.Unmap().As16()
	hash := uint64(fnvOffset64)
	for _, value := range address {
		hash ^= uint64(value)
		hash *= fnvPrime64
	}
	return int(hash % uint64(shardCount))
}
