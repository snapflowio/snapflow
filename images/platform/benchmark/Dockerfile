# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM golang:1.27.4-bookworm@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea AS tool

WORKDIR /src
COPY apps/snapflow ./apps/snapflow
COPY libs/api-client-go ./libs/api-client-go
COPY libs/common-go ./libs/common-go
COPY libs/contracts-go ./libs/contracts-go
COPY libs/machine-proto ./libs/machine-proto
COPY libs/microvm-go ./libs/microvm-go
COPY libs/tunnel-go ./libs/tunnel-go

ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH}" go build \
    -C apps/snapflow -trimpath -ldflags="-s -w" \
    -o /out/machine-benchmark ./cmd/machine-benchmark

FROM nvidia/cuda:13.5.0-devel-ubuntu24.04@sha256:d3fa71793540a2b76ab227ee00016e754da2758b7a51b49bc8a72543af5a8bc2 AS helper

WORKDIR /src
COPY images/platform/benchmark/gemm/gemm.cu ./gemm.cu
RUN mkdir /out \
    && nvcc -O3 -std=c++17 -arch=all -o /out/gpu-gemm gemm.cu -lcublas

FROM nvidia/cuda:13.5.0-runtime-ubuntu24.04@sha256:ba4d4e8475ced890fb26f9661daf8dae7cce9827613682eb8b8379c5ecd94eba

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=tool --chmod=0755 /out/machine-benchmark /usr/local/bin/machine-benchmark
COPY --from=helper --chmod=0755 /out/gpu-gemm /usr/local/bin/gpu-gemm
