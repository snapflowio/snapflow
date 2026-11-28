module github.com/snapflowio/microvm-go

go 1.27.4

exclude google.golang.org/genproto v0.0.0-20200526211855-cb27e3aa2013

require (
	github.com/aws/aws-sdk-go-v2 v1.48.0
	github.com/aws/aws-sdk-go-v2/credentials v1.21.3
	github.com/aws/aws-sdk-go-v2/service/s3 v1.116.0
	github.com/cenkalti/backoff/v5 v5.0.3
	github.com/coreos/go-systemd/v22 v22.7.0
	github.com/distribution/reference v0.6.0
	github.com/docker/cli v29.9.3+incompatible
	github.com/ebitengine/purego v0.11.3
	github.com/florianl/go-nfqueue/v2 v2.1.0
	github.com/godbus/dbus/v5 v5.2.4
	github.com/google/go-containerregistry v0.22.1
	github.com/google/nftables v0.3.0
	github.com/google/uuid v1.6.0
	github.com/insomniacslk/dhcp v0.0.0-20261014062924-c6bb46ad3f3a
	github.com/klauspost/compress v1.20.4
	github.com/klauspost/pgzip v1.3.0
	github.com/labstack/echo/v5 v5.4.5
	github.com/mdlayher/netlink v1.11.2
	github.com/mdlayher/vsock v1.4.0
	github.com/miekg/dns v1.1.73
	github.com/moby/buildkit v0.35.0
	github.com/moby/sys/user v0.5.0
	github.com/opencontainers/go-digest v1.0.0
	github.com/opencontainers/image-spec v1.1.1
	github.com/pelletier/go-toml/v2 v2.4.3
	github.com/ramr/go-reaper v0.3.1
	github.com/tonistiigi/fsutil v0.0.0-20261103125000-e075fd9305eb
	github.com/vishvananda/netlink v1.3.1
	github.com/vishvananda/netns v0.0.5
	golang.org/x/net v0.62.0
	golang.org/x/sync v0.25.0
	golang.org/x/sys v0.50.0
)

require (
	github.com/Microsoft/go-winio v0.6.4 // indirect
	github.com/ProtonMail/go-crypto v1.5.2 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.27 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.12 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.12 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.12 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.25 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.12 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.12 // indirect
	github.com/aws/smithy-go v1.28.9 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/cloudflare/circl v1.6.5 // indirect
	github.com/containerd/console v1.0.5 // indirect
	github.com/containerd/containerd/api v1.12.0 // indirect
	github.com/containerd/containerd/v2 v2.4.2 // indirect
	github.com/containerd/continuity v0.5.0 // indirect
	github.com/containerd/errdefs v1.0.0 // indirect
	github.com/containerd/errdefs/pkg v0.3.0 // indirect
	github.com/containerd/log v0.2.0 // indirect
	github.com/containerd/log/otel v0.1.0 // indirect
	github.com/containerd/platforms v1.0.0-rc.5 // indirect
	github.com/containerd/ttrpc v1.2.10 // indirect
	github.com/containerd/typeurl/v2 v2.3.0 // indirect
	github.com/docker/docker-credential-helpers v0.9.13 // indirect
	github.com/felixge/httpsnoop v1.1.0 // indirect
	github.com/go-logr/logr v1.4.4 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/gofrs/flock v0.13.2 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.33.0 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/in-toto/attestation v1.2.0 // indirect
	github.com/in-toto/in-toto-golang v0.11.0 // indirect
	github.com/mdlayher/packet v1.2.0 // indirect
	github.com/mdlayher/socket v0.8.0 // indirect
	github.com/moby/locker v1.0.1 // indirect
	github.com/moby/patternmatcher v0.6.1 // indirect
	github.com/moby/sys/signal v0.7.1 // indirect
	github.com/morikuni/aec v1.1.0 // indirect
	github.com/pierrec/lz4/v4 v4.1.33 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
	github.com/secure-systems-lab/go-securesystemslib v0.11.1 // indirect
	github.com/shibumi/go-pathspec v1.3.0 // indirect
	github.com/sigstore/protobuf-specs v0.5.2 // indirect
	github.com/sigstore/sigstore v1.11.3 // indirect
	github.com/sirupsen/logrus v1.10.2 // indirect
	github.com/tonistiigi/go-csvvalue v0.0.0-20240814133006-030d3b2625d0 // indirect
	github.com/tonistiigi/units v0.0.0-20180711220420-6950e57a87ea // indirect
	github.com/tonistiigi/vt100 v0.0.0-20240514184818-90bafcd6abab // indirect
	github.com/u-root/uio v0.0.0-20240224005618-d2acac8f3701 // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.72.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.72.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.72.0 // indirect
	go.opentelemetry.io/otel v1.47.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.47.0 // indirect
	go.opentelemetry.io/otel/log v1.47.0 // indirect
	go.opentelemetry.io/otel/metric v1.47.0 // indirect
	go.opentelemetry.io/otel/sdk v1.47.0 // indirect
	go.opentelemetry.io/otel/trace v1.47.0 // indirect
	go.opentelemetry.io/proto/otlp v1.11.1 // indirect
	golang.org/x/crypto v0.59.0 // indirect
	golang.org/x/mod v0.43.0 // indirect
	golang.org/x/text v0.44.0 // indirect
	golang.org/x/time v0.16.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20261110000943-09e21b237f2c // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20261110000943-09e21b237f2c // indirect
	google.golang.org/grpc v1.85.0 // indirect
	google.golang.org/protobuf v1.36.12 // indirect
	gotest.tools/v3 v3.5.2 // indirect
)
