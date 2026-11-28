// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

// Output layout, all integers little-endian:
//   vram: uint64 allocated bytes.
//   gemm: uint64 window count, then per window uint64 GEMM count and uint64 elapsed
//         nanoseconds, then the FP32 product of dimension x dimension, row-major.

#include <cublas_v2.h>
#include <cuda_fp16.h>
#include <cuda_runtime.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr int kThreadsPerBlock = 256;
constexpr int kGemmBatch = 8;
constexpr int kClearByte = 0;
constexpr double kMillisecondsPerSecond = 1000.0;
constexpr double kNanosecondsPerMillisecond = 1e6;
constexpr int kExitUsage = 2;
constexpr int kExitFailure = 1;
constexpr int kVramArguments = 4;
constexpr int kGemmArguments = 6;
constexpr int kDecimalBase = 10;
constexpr int kBitsPerByte = 8;
constexpr const char* kVramCommand = "vram";
constexpr const char* kGemmCommand = "gemm";
constexpr const char* kUsage =
    "usage: gpu-gemm vram <device> <reserve-bytes> | gpu-gemm gemm <device> <dimension> <seconds> <window-seconds>\n";

struct Window {
  uint64_t iterations;
  uint64_t elapsedNanoseconds;
};

void check(cudaError_t status, const char* operation) {
  if (status != cudaSuccess) {
    throw std::runtime_error(std::string(operation) + ": " + cudaGetErrorString(status));
  }
}

void check(cublasStatus_t status, const char* operation) {
  if (status != CUBLAS_STATUS_SUCCESS) {
    throw std::runtime_error(std::string(operation) + ": " + cublasGetStatusString(status));
  }
}

void readExact(void* destination, size_t bytes) {
  if (std::fread(destination, 1, bytes, stdin) != bytes) {
    throw std::runtime_error("read input");
  }
}

void writeExact(const void* source, size_t bytes) {
  if (std::fwrite(source, 1, bytes, stdout) != bytes) {
    throw std::runtime_error("write output");
  }
}

void writeLittleEndian(uint64_t value) {
  unsigned char encoded[sizeof(value)];
  for (size_t index = 0; index < sizeof(value); ++index) {
    encoded[index] = static_cast<unsigned char>(value >> (index * kBitsPerByte));
  }
  writeExact(encoded, sizeof(encoded));
}

uint64_t parseUnsigned(const char* value) {
  char* end = nullptr;
  const unsigned long long parsed = std::strtoull(value, &end, kDecimalBase);
  if (end == value || *end != '\0') {
    throw std::runtime_error(std::string("invalid number ") + value);
  }
  return parsed;
}

__global__ void widen(const int8_t* source, __half* destination, size_t count) {
  const size_t index = static_cast<size_t>(blockIdx.x) * blockDim.x + threadIdx.x;
  if (index < count) {
    destination[index] = __int2half_rn(source[index]);
  }
}

class DeviceBuffer {
 public:
  explicit DeviceBuffer(size_t bytes) { check(cudaMalloc(&data_, bytes), "allocate device memory"); }
  ~DeviceBuffer() { cudaFree(data_); }
  DeviceBuffer(const DeviceBuffer&) = delete;
  DeviceBuffer& operator=(const DeviceBuffer&) = delete;
  template <typename T>
  T* as() const {
    return static_cast<T*>(data_);
  }

 private:
  void* data_ = nullptr;
};

class Event {
 public:
  Event() { check(cudaEventCreate(&event_), "create event"); }
  ~Event() { cudaEventDestroy(event_); }
  Event(const Event&) = delete;
  Event& operator=(const Event&) = delete;
  cudaEvent_t get() const { return event_; }

 private:
  cudaEvent_t event_ = nullptr;
};

class BlasHandle {
 public:
  BlasHandle() { check(cublasCreate(&handle_), "create cuBLAS handle"); }
  ~BlasHandle() { cublasDestroy(handle_); }
  BlasHandle(const BlasHandle&) = delete;
  BlasHandle& operator=(const BlasHandle&) = delete;
  cublasHandle_t get() const { return handle_; }

 private:
  cublasHandle_t handle_ = nullptr;
};

void clearVram(uint64_t reserveBytes) {
  size_t freeBytes = 0;
  size_t totalBytes = 0;
  check(cudaMemGetInfo(&freeBytes, &totalBytes), "query device memory");
  if (freeBytes <= reserveBytes) {
    throw std::runtime_error("the device has no free memory beyond the reserve");
  }
  const size_t bytes = freeBytes - static_cast<size_t>(reserveBytes);
  DeviceBuffer device(bytes);
  check(cudaMemset(device.as<char>(), kClearByte, bytes), "clear device memory");
  check(cudaDeviceSynchronize(), "synchronize");
  writeLittleEndian(bytes);
}

void uploadMatrix(const std::vector<int8_t>& matrix, const DeviceBuffer& staging, const DeviceBuffer& widened) {
  const size_t count = matrix.size();
  check(cudaMemcpy(staging.as<int8_t>(), matrix.data(), count, cudaMemcpyHostToDevice), "copy matrix");
  const unsigned int blocks = static_cast<unsigned int>((count + kThreadsPerBlock - 1) / kThreadsPerBlock);
  widen<<<blocks, kThreadsPerBlock>>>(staging.as<int8_t>(), widened.as<__half>(), count);
  check(cudaGetLastError(), "widen matrix");
}

template <typename Gemm>
std::vector<Window> timeWindows(const Gemm& gemm, uint64_t windowCount, uint64_t windowSeconds) {
  const float windowMilliseconds = static_cast<float>(windowSeconds * kMillisecondsPerSecond);
  Event first;
  Event second;
  cudaEvent_t windowStart = first.get();
  cudaEvent_t batchEnd = second.get();
  std::vector<Window> windows;
  windows.reserve(windowCount);
  check(cudaEventRecord(windowStart), "record window start");
  while (windows.size() < windowCount) {
    uint64_t iterations = 0;
    float elapsedMilliseconds = 0.0F;
    while (elapsedMilliseconds < windowMilliseconds) {
      for (int batch = 0; batch < kGemmBatch; ++batch) {
        gemm();
      }
      iterations += kGemmBatch;
      check(cudaEventRecord(batchEnd), "record batch end");
      check(cudaEventSynchronize(batchEnd), "synchronize batch end");
      check(cudaEventElapsedTime(&elapsedMilliseconds, windowStart, batchEnd), "measure window");
    }
    windows.push_back({iterations, static_cast<uint64_t>(elapsedMilliseconds * kNanosecondsPerMillisecond)});
    std::swap(windowStart, batchEnd);
  }
  return windows;
}

void multiply(uint64_t dimension, uint64_t seconds, uint64_t windowSeconds) {
  if (windowSeconds == 0 || seconds < windowSeconds) {
    throw std::runtime_error("the GEMM run needs a positive window no longer than the run");
  }
  const size_t count = static_cast<size_t>(dimension * dimension);
  std::vector<int8_t> left(count);
  std::vector<int8_t> right(count);
  readExact(left.data(), count);
  readExact(right.data(), count);
  DeviceBuffer staging(count);
  DeviceBuffer leftHalf(count * sizeof(__half));
  DeviceBuffer rightHalf(count * sizeof(__half));
  DeviceBuffer product(count * sizeof(float));
  uploadMatrix(left, staging, leftHalf);
  uploadMatrix(right, staging, rightHalf);
  BlasHandle handle;
  const int size = static_cast<int>(dimension);
  const float alpha = 1.0F;
  const float beta = 0.0F;
  auto gemm = [&]() {
    check(cublasGemmEx(handle.get(), CUBLAS_OP_N, CUBLAS_OP_N, size, size, size, &alpha, rightHalf.as<__half>(),
                       CUDA_R_16F, size, leftHalf.as<__half>(), CUDA_R_16F, size, &beta, product.as<float>(),
                       CUDA_R_32F, size, CUBLAS_COMPUTE_32F, CUBLAS_GEMM_DEFAULT),
          "multiply");
  };
  gemm();
  check(cudaDeviceSynchronize(), "warm up");
  const std::vector<Window> windows = timeWindows(gemm, seconds / windowSeconds, windowSeconds);
  std::vector<float> rows(count);
  check(cudaMemcpy(rows.data(), product.as<float>(), count * sizeof(float), cudaMemcpyDeviceToHost), "copy product");
  writeLittleEndian(windows.size());
  for (const Window& window : windows) {
    writeLittleEndian(window.iterations);
    writeLittleEndian(window.elapsedNanoseconds);
  }
  writeExact(rows.data(), count * sizeof(float));
}

}

int main(int argc, char** argv) {
  try {
    if (argc == kVramArguments && std::strcmp(argv[1], kVramCommand) == 0) {
      check(cudaSetDevice(static_cast<int>(parseUnsigned(argv[2]))), "select device");
      clearVram(parseUnsigned(argv[3]));
    } else if (argc == kGemmArguments && std::strcmp(argv[1], kGemmCommand) == 0) {
      check(cudaSetDevice(static_cast<int>(parseUnsigned(argv[2]))), "select device");
      multiply(parseUnsigned(argv[3]), parseUnsigned(argv[4]), parseUnsigned(argv[5]));
    } else {
      std::fputs(kUsage, stderr);
      return kExitUsage;
    }
    if (std::fflush(stdout) != 0) {
      throw std::runtime_error("flush output");
    }
  } catch (const std::exception& failure) {
    std::fprintf(stderr, "gpu-gemm: %s\n", failure.what());
    return kExitFailure;
  }
  return 0;
}
