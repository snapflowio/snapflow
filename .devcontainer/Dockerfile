FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS go-tools

ARG GOFUMPT_VERSION=v0.10.0
ARG GOVULNCHECK_VERSION=v1.5.0
ARG GOW_VERSION=3b8e4d082711cd6f5ce5139450fcb3d01613c546
ARG BUF_VERSION=v1.72.0
ARG PROTOC_GEN_GO_VERSION=v1.36.11

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
  GOBIN=/out go install mvdan.cc/gofumpt@"${GOFUMPT_VERSION}" \
  && GOBIN=/out go install golang.org/x/vuln/cmd/govulncheck@"${GOVULNCHECK_VERSION}" \
  && GOBIN=/out go install github.com/mitranim/gow@"${GOW_VERSION}" \
  && GOBIN=/out go install github.com/bufbuild/buf/cmd/buf@"${BUF_VERSION}" \
  && GOBIN=/out go install google.golang.org/protobuf/cmd/protoc-gen-go@"${PROTOC_GEN_GO_VERSION}"

FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8 AS erofs-utils

COPY --chmod=0755 scripts/build-erofs-utils.sh /usr/local/bin/build-erofs-utils
RUN build-erofs-utils /out

FROM moby/buildkit:v0.32.2@sha256:28a898719c18a33f4e8000685287fa36fd0dd9560c6440227d3a732d79bb41d8 AS buildkit-tools

FROM mcr.microsoft.com/devcontainers/base:bookworm@sha256:bb7b81b6e5be17b5267f92f4ffda534fea37dab1df97b5e86c1f9b91da5c0b5d

ARG DEBIAN_FRONTEND=noninteractive
ARG MOON_VERSION=2.4.6
ARG CODEX_VERSION=0.145.0
ARG FOUNDRY_VERSION=1.9.0
ARG ADERYN_VERSION=0.6.8
ARG MEDUSA_VERSION=1.5.1
# Medusa publishes Sigstore bundles but no checksum file; this is the release's medusa-linux-x64.tar.gz digest.
ARG MEDUSA_SHA256=ddfe1517ae9028ef9fc331b00f5a6a9d5406f3fcd11a715d60c6b6fb3e4546d3
ARG CRYTIC_COMPILE_VERSION=0.4.2
ARG KUBECTL_VERSION=1.37.1
ARG HELM_VERSION=4.3.1
ARG FLUX_VERSION=2.9.6
ARG KUBECONFORM_VERSION=0.8.0
ARG OPENBAO_VERSION=2.7.1
ARG TRIVY_VERSION=0.76.0

RUN curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    acl \
    binfmt-support \
    ca-certificates \
    cmake \
    curl \
    ethtool \
    gnupg \
    iptables \
    jq \
    kmod \
    libgtk-3-0 \
    libx11-dev \
    libxext-dev \
    libxi-dev \
    libxinerama-dev \
    libxrandr-dev \
    libxtst-dev \
    musl-tools \
    pciutils \
    pipx \
    postgresql-client-17 \
    procps \
    qemu-user-static \
    redis-tools \
    shellcheck \
    tcpdump \
    uidmap \
    xauth \
    xfsprogs \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

RUN curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    https://moonrepo.dev/install/moon.sh -o /tmp/install-moon.sh \
  && MOON_INSTALL_DIR=/usr/local/bin MOON_CLI_NO_MODIFY_PATH=1 \
    bash /tmp/install-moon.sh "${MOON_VERSION}" \
  && rm /tmp/install-moon.sh \
  && moon --version

RUN curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL https://chatgpt.com/codex/install.sh \
  | CODEX_RELEASE="${CODEX_VERSION}" CODEX_NON_INTERACTIVE=1 CODEX_INSTALL_DIR=/usr/local/bin CODEX_HOME=/opt/codex sh

RUN package="foundry_v${FOUNDRY_VERSION}_linux_$(dpkg --print-architecture)" \
  && release="https://github.com/foundry-rs/foundry/releases/download/v${FOUNDRY_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}.tar.gz" -o "/tmp/${package}.tar.gz" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}.sha256" -o "/tmp/${package}.sha256" \
  && (cd /tmp && sha256sum -c "${package}.sha256") \
  && tar -xzf "/tmp/${package}.tar.gz" -C /usr/local/bin forge cast anvil chisel \
  && rm "/tmp/${package}.tar.gz" "/tmp/${package}.sha256" \
  && forge --version

RUN package="aderyn-x86_64-unknown-linux-gnu" \
  && release="https://github.com/Cyfrin/aderyn/releases/download/aderyn-v${ADERYN_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}.tar.xz" -o "/tmp/${package}.tar.xz" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}.tar.xz.sha256" -o "/tmp/${package}.tar.xz.sha256" \
  && (cd /tmp && sha256sum -c "${package}.tar.xz.sha256") \
  && tar -xJf "/tmp/${package}.tar.xz" -C /usr/local/bin --strip-components=1 "${package}/aderyn" \
  && rm "/tmp/${package}.tar.xz" "/tmp/${package}.tar.xz.sha256" \
  && aderyn --version

RUN package="medusa-linux-x64.tar.gz" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "https://github.com/crytic/medusa/releases/download/v${MEDUSA_VERSION}/${package}" -o "/tmp/${package}" \
  && echo "${MEDUSA_SHA256}  /tmp/${package}" | sha256sum -c - \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin medusa \
  && rm "/tmp/${package}" \
  && PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin pipx install "crytic-compile==${CRYTIC_COMPILE_VERSION}" \
  && medusa --version \
  && crytic-compile --version

RUN release="https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/amd64" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/kubectl" -o /tmp/kubectl \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/kubectl.sha256" -o /tmp/kubectl.sha256 \
  && echo "$(cat /tmp/kubectl.sha256)  /tmp/kubectl" | sha256sum -c - \
  && install -m 0755 /tmp/kubectl /usr/local/bin/kubectl \
  && rm /tmp/kubectl /tmp/kubectl.sha256 \
  && kubectl version --client

RUN package="helm-v${HELM_VERSION}-linux-amd64.tar.gz" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "https://get.helm.sh/${package}" -o "/tmp/${package}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "https://get.helm.sh/${package}.sha256sum" -o "/tmp/${package}.sha256sum" \
  && (cd /tmp && sha256sum -c "${package}.sha256sum") \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin --strip-components=1 linux-amd64/helm \
  && rm "/tmp/${package}" "/tmp/${package}.sha256sum" \
  && helm version

RUN package="flux_${FLUX_VERSION}_linux_amd64.tar.gz" \
  && release="https://github.com/fluxcd/flux2/releases/download/v${FLUX_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}" -o "/tmp/${package}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/flux_${FLUX_VERSION}_checksums.txt" -o /tmp/flux-checksums.txt \
  && (cd /tmp && grep "  ${package}\$" flux-checksums.txt | sha256sum -c -) \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin flux \
  && rm "/tmp/${package}" /tmp/flux-checksums.txt \
  && flux version --client

RUN package="kubeconform-linux-amd64.tar.gz" \
  && release="https://github.com/yannh/kubeconform/releases/download/v${KUBECONFORM_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}" -o "/tmp/${package}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/CHECKSUMS" -o /tmp/kubeconform-checksums.txt \
  && (cd /tmp && grep "  ${package}\$" kubeconform-checksums.txt | sha256sum -c -) \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin kubeconform \
  && rm "/tmp/${package}" /tmp/kubeconform-checksums.txt \
  && kubeconform -v

RUN package="openbao_${OPENBAO_VERSION}_linux_amd64.tar.gz" \
  && release="https://github.com/openbao/openbao/releases/download/v${OPENBAO_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}" -o "/tmp/${package}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/checksums.txt" -o /tmp/openbao-checksums.txt \
  && (cd /tmp && grep "  ${package}\$" openbao-checksums.txt | sha256sum -c -) \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin bao \
  && rm "/tmp/${package}" /tmp/openbao-checksums.txt \
  && bao version

RUN package="trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
  && release="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}" -o "/tmp/${package}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/trivy_${TRIVY_VERSION}_checksums.txt" -o /tmp/trivy-checksums.txt \
  && (cd /tmp && grep "  ${package}\$" trivy-checksums.txt | sha256sum -c -) \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin trivy \
  && rm "/tmp/${package}" /tmp/trivy-checksums.txt \
  && trivy --version

COPY --from=go-tools /out/ /usr/local/bin/
COPY --from=buildkit-tools /usr/bin/buildctl /usr/local/bin/buildctl
COPY --from=erofs-utils /out/mkfs.erofs /usr/local/bin/mkfs.erofs
COPY --chmod=0755 scripts/gui-run.sh /usr/local/bin/gui-run

RUN install -d -o vscode -g vscode \
    /home/vscode/go/pkg/mod \
    /home/vscode/.cache/go-build \
    /home/vscode/.cache/go-tmp \
    /home/vscode/.cache/node/corepack \
    /home/vscode/.cache/npm \
    /home/vscode/.cache/tmp \
    /home/vscode/.local/bin \
    /home/vscode/.local/share/pnpm/store \
    /home/vscode/.local/state/snapflow \
    /home/vscode/.t3 \
  && chown -R vscode:vscode \
    /home/vscode/.cache \
    /home/vscode/.local \
    /home/vscode/go

ENV PATH="/home/vscode/.local/bin:/home/vscode/.local/share/pnpm:/home/vscode/.local/share/pnpm/bin:${PATH}"

USER vscode
WORKDIR /workspaces/snapflow
