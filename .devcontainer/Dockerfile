FROM golang:1.27.4-bookworm@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea AS go-tools

ARG GOFUMPT_VERSION=v0.12.0
ARG GOVULNCHECK_VERSION=v1.9.0
ARG GOW_VERSION=3b8e4d082711cd6f5ce5139450fcb3d01613c546
ARG BUF_VERSION=v1.75.0
ARG PROTOC_GEN_GO_VERSION=v1.36.12

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
  GOBIN=/out go install mvdan.cc/gofumpt@"${GOFUMPT_VERSION}" \
  && GOBIN=/out go install golang.org/x/vuln/cmd/govulncheck@"${GOVULNCHECK_VERSION}" \
  && GOBIN=/out go install github.com/mitranim/gow@"${GOW_VERSION}" \
  && GOBIN=/out go install github.com/bufbuild/buf/cmd/buf@"${BUF_VERSION}" \
  && GOBIN=/out go install google.golang.org/protobuf/cmd/protoc-gen-go@"${PROTOC_GEN_GO_VERSION}"

ARG GOLANGCI_LINT_VERSION=v2.15.0
ARG GOPLS_VERSION=v0.24.0
ARG DELVE_VERSION=v1.27.2

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
  GOBIN=/out go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@"${GOLANGCI_LINT_VERSION}" \
  && GOBIN=/out go install golang.org/x/tools/gopls@"${GOPLS_VERSION}" \
  && GOBIN=/out go install github.com/go-delve/delve/cmd/dlv@"${DELVE_VERSION}"

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS erofs-utils

COPY --chmod=0755 scripts/build-erofs-utils.sh /usr/local/bin/build-erofs-utils
RUN build-erofs-utils /out

FROM moby/buildkit:v0.35.0@sha256:aa632b921ef07411d2cb77292cd34213d4f7b384001d6fceef1e1f25bf9752bb AS buildkit-tools

FROM mcr.microsoft.com/devcontainers/base:trixie@sha256:38f9e6c291f054e3c868d95a5477cbfcf76c0fa7c218dda65dc6aa3fbfe06871

ARG DEBIAN_FRONTEND=noninteractive
ARG MOON_VERSION=2.6.5
ARG CODEX_VERSION=0.169.0
ARG FOUNDRY_VERSION=1.9.0
ARG KUBECTL_VERSION=1.37.2
ARG HELM_VERSION=4.3.2
ARG FLUX_VERSION=2.10.0
ARG KUBECONFORM_VERSION=0.8.0
ARG OPENBAO_VERSION=2.7.2
ARG OPENTOFU_VERSION=1.13.10
ARG TRIVY_VERSION=0.76.2
ARG YQ_VERSION=4.54.3
ARG DOCKER_VERSION=29.9.3
ARG CONTAINERD_VERSION=2.4.2-4
ARG DOCKER_BUILDX_VERSION=0.39.0-1
ARG DOCKER_COMPOSE_VERSION=5.7.1-1

RUN curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt trixie-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    acl \
    binfmt-support \
    ca-certificates \
    cmake \
    curl \
    e2fsprogs \
    ethtool \
    gnupg \
    iptables \
    jq \
    kmod \
    libgtk-3-0t64 \
    libx11-dev \
    libxext-dev \
    libxi-dev \
    libxinerama-dev \
    libxrandr-dev \
    libxtst-dev \
    musl-tools \
    pciutils \
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

RUN package="tofu_${OPENTOFU_VERSION}_linux_amd64.tar.gz" \
  && release="https://github.com/opentofu/opentofu/releases/download/v${OPENTOFU_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/${package}" -o "/tmp/${package}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/tofu_${OPENTOFU_VERSION}_SHA256SUMS" -o /tmp/tofu-checksums.txt \
  && (cd /tmp && grep "  ${package}\$" tofu-checksums.txt | sha256sum -c -) \
  && tar -xzf "/tmp/${package}" -C /usr/local/bin tofu \
  && rm "/tmp/${package}" /tmp/tofu-checksums.txt \
  && tofu version

RUN release="https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}" \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/yq_linux_amd64" -o /tmp/yq \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/checksums" -o /tmp/yq-checksums \
  && curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    "${release}/checksums_hashes_order" -o /tmp/yq-checksums-order \
  && column="$(($(grep -n -x 'SHA-256' /tmp/yq-checksums-order | cut -d: -f1) + 1))" \
  && echo "$(awk -v column="${column}" '$1 == "yq_linux_amd64" { print $column }' /tmp/yq-checksums)  /tmp/yq" | sha256sum -c - \
  && install -m 0755 /tmp/yq /usr/local/bin/yq \
  && rm /tmp/yq /tmp/yq-checksums /tmp/yq-checksums-order \
  && yq --version

COPY --from=ghcr.io/astral-sh/uv:0.13.10@sha256:a3ea1357342c1a4bf9a0c53a3deb1b55379aefa037338d8113d5771efa01774f /uv /uvx /usr/local/bin/

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

RUN curl --http1.1 --retry 5 --retry-all-errors --retry-delay 2 -fsSL \
    https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /usr/share/keyrings/docker.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/debian trixie stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    "docker-ce=5:${DOCKER_VERSION}-1~debian.13~trixie" \
    "docker-ce-cli=5:${DOCKER_VERSION}-1~debian.13~trixie" \
    "containerd.io=${CONTAINERD_VERSION}~debian.13~trixie" \
    "docker-buildx-plugin=${DOCKER_BUILDX_VERSION}~debian.13~trixie" \
    "docker-compose-plugin=${DOCKER_COMPOSE_VERSION}~debian.13~trixie" \
  && rm -rf /var/lib/apt/lists/* \
  && sed -i 's/^disabled_plugins = .*/disabled_plugins = ["cri", "io.containerd.snapshotter.v1.erofs"]/' \
    /etc/containerd/config.toml \
  && usermod -aG docker vscode \
  && docker --version

RUN systemctl mask \
    getty.target \
    console-getty.service \
    systemd-pstore.service \
    apt-daily.timer \
    apt-daily-upgrade.timer \
    e2scrub_all.timer \
    e2scrub_reap.service \
    fstrim.timer \
  && ln -s /dev/null /etc/tmpfiles.d/x11.conf \
  && install -d /etc/systemd/journald.conf.d \
  && printf '[Journal]\nReadKMsg=no\n' > /etc/systemd/journald.conf.d/container.conf

COPY --from=go-tools /usr/local/go /usr/local/go
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

ENV PATH="/usr/local/go/bin:/home/vscode/.local/bin:/home/vscode/.local/share/pnpm:/home/vscode/.local/share/pnpm/bin:${PATH}"
ENV container=docker

WORKDIR /workspaces/snapflow
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
