/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const UPDATE_CURRENT_USAGE_SCRIPT = `
  local cacheKey = KEYS[1]
  local pendingCacheKey = KEYS[2]
  local delta = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  if redis.call("EXISTS", cacheKey) == 1 then
    redis.call("INCRBY", cacheKey, delta)
    redis.call("EXPIRE", cacheKey, ttl)
  end

  local pending = tonumber(redis.call("GET", pendingCacheKey))
  if pending and pending > 0 and delta > 0 then
    redis.call("DECRBY", pendingCacheKey, delta)
  end
`;

export const INCREMENT_PENDING_SANDBOX_USAGE_SCRIPT = `
  local cpuKey = KEYS[1]
  local memoryKey = KEYS[2]
  local diskKey = KEYS[3]
  local gpuKey = KEYS[4]

  local shouldIncrementCpu = ARGV[1] == "true"
  local shouldIncrementMemory = ARGV[2] == "true"
  local shouldIncrementDisk = ARGV[3] == "true"
  local shouldIncrementGpu = ARGV[4] == "true"

  local cpuIncrement = tonumber(ARGV[5])
  local memoryIncrement = tonumber(ARGV[6])
  local diskIncrement = tonumber(ARGV[7])
  local gpuIncrement = tonumber(ARGV[8])

  local ttl = tonumber(ARGV[9])

  if shouldIncrementCpu then
    redis.call("INCRBY", cpuKey, cpuIncrement)
    redis.call("EXPIRE", cpuKey, ttl)
  end

  if shouldIncrementMemory then
    redis.call("INCRBY", memoryKey, memoryIncrement)
    redis.call("EXPIRE", memoryKey, ttl)
  end

  if shouldIncrementDisk then
    redis.call("INCRBY", diskKey, diskIncrement)
    redis.call("EXPIRE", diskKey, ttl)
  end

  if shouldIncrementGpu then
    redis.call("INCRBY", gpuKey, gpuIncrement)
    redis.call("EXPIRE", gpuKey, ttl)
  end
`;

export const RESERVE_PENDING_SANDBOX_USAGE_SCRIPT = `
  local resourceCount = #KEYS / 2
  local cacheMiss = -1
  local rejected = 0
  local accepted = 1
  local current = {}
  local pending = {}
  local requested = {}
  local shouldIncrement = {}
  local maximum = {}

  for index = 1, resourceCount do
    local currentValue = redis.call("GET", KEYS[index])
    if not currentValue then
      return {cacheMiss}
    end
    current[index] = tonumber(currentValue)
    pending[index] = tonumber(redis.call("GET", KEYS[index + resourceCount])) or 0
    shouldIncrement[index] = ARGV[index] == "true"
    requested[index] = tonumber(ARGV[index + resourceCount])
    maximum[index] = tonumber(ARGV[index + (resourceCount * 2)])
  end

  local totals = {}
  for index = 1, resourceCount do
    local increment = shouldIncrement[index] and requested[index] or 0
    totals[index] = current[index] + pending[index] + increment
  end
  for index = 1, resourceCount do
    if totals[index] > maximum[index] then
      local response = {rejected, index}
      for totalIndex = 1, resourceCount do
        response[#response + 1] = totals[totalIndex]
      end
      return response
    end
  end

  local ttl = tonumber(ARGV[(resourceCount * 3) + 1])
  for index = 1, resourceCount do
    if shouldIncrement[index] and requested[index] > 0 then
      redis.call("INCRBY", KEYS[index + resourceCount], requested[index])
      redis.call("EXPIRE", KEYS[index + resourceCount], ttl)
    end
  end
  local response = {accepted, 0}
  for totalIndex = 1, resourceCount do
    response[#response + 1] = totals[totalIndex]
  end
  return response
`;

export const DECREMENT_PENDING_SANDBOX_USAGE_SCRIPT = `
  local cpuKey = KEYS[1]
  local memoryKey = KEYS[2]
  local diskKey = KEYS[3]
  local gpuKey = KEYS[4]

  local cpuDecrement = tonumber(ARGV[1])
  local memoryDecrement = tonumber(ARGV[2])
  local diskDecrement = tonumber(ARGV[3])
  local gpuDecrement = tonumber(ARGV[4])

  local function decrementClamped(key, amount)
    if amount and amount > 0 and redis.call("EXISTS", key) == 1 then
      local current = tonumber(redis.call("GET", key))
      redis.call("SET", key, math.max(0, current - amount), "KEEPTTL")
    end
  end

  decrementClamped(cpuKey, cpuDecrement)
  decrementClamped(memoryKey, memoryDecrement)
  decrementClamped(diskKey, diskDecrement)
  decrementClamped(gpuKey, gpuDecrement)
`;

export const INCREMENT_PENDING_COUNT_USAGE_SCRIPT = `
  local countKey = KEYS[1]

  local countIncrement = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  redis.call("INCRBY", countKey, countIncrement)
  redis.call("EXPIRE", countKey, ttl)
`;

export const DECREMENT_PENDING_COUNT_USAGE_SCRIPT = `
  local countKey = KEYS[1]

  local countDecrement = tonumber(ARGV[1])

  if countDecrement then
    redis.call("DECRBY", countKey, countDecrement)
  end
`;
