# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS tool

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

FROM nvidia/cuda:13.2.0-devel-ubuntu24.04@sha256:f9492f2eea77fbc3d0c14fa8738f35946b42da72917bf5959d284ca39b4f209a AS helper

WORKDIR /src
COPY images/platform/benchmark/gemm/gemm.cu ./gemm.cu
RUN mkdir /out \
    && nvcc -O3 -std=c++17 -arch=all -o /out/gpu-gemm gemm.cu -lcublas

FROM nvidia/cuda:13.2.0-runtime-ubuntu24.04@sha256:7fada70c5ed1b85cb3c15b53f51300fdacff1c31466a20e4f2b29ad952fd63a2

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=tool --chmod=0755 /out/machine-benchmark /usr/local/bin/machine-benchmark
COPY --from=helper --chmod=0755 /out/gpu-gemm /usr/local/bin/gpu-gemm
