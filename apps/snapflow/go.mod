module github.com/snapflowio/snapflow

go 1.27.4

replace github.com/snapflowio/snapflow/libs/api-client-go => ../../libs/api-client-go

replace github.com/snapflowio/microvm-go => ../../libs/microvm-go

replace github.com/snapflowio/snapflow/libs/machine-proto => ../../libs/machine-proto

replace github.com/snapflowio/contracts-go => ../../libs/contracts-go

require (
	github.com/coreos/go-systemd/v22 v22.7.0
	github.com/distribution/reference v0.6.0
	github.com/ethereum/go-ethereum v1.17.10
	github.com/godbus/dbus/v5 v5.2.4
	github.com/google/go-containerregistry v0.22.1
	github.com/google/uuid v1.6.0
	github.com/klauspost/compress v1.20.4
	github.com/labstack/echo-otel/v5 v5.0.0
	github.com/labstack/echo/v5 v5.4.5
	github.com/opencontainers/go-digest v1.0.0
	github.com/prometheus/client_golang v1.25.0
	github.com/shirou/gopsutil/v4 v4.26.10
	github.com/sigstore/sigstore v1.11.3
	github.com/snapflowio/common-go v0.0.0-00010101000000-000000000000
	github.com/snapflowio/contracts-go v0.0.0-00010101000000-000000000000
	github.com/snapflowio/microvm-go v0.0.0-00010101000000-000000000000
	github.com/snapflowio/snapflow/libs/api-client-go v0.152.1
	github.com/snapflowio/snapflow/libs/machine-proto v0.0.0-00010101000000-000000000000
	github.com/snapflowio/tunnel-go v0.0.0-00010101000000-000000000000
	github.com/spf13/cobra v1.10.2
	github.com/spf13/pflag v1.1.0
	github.com/swaggo/http-swagger/v2 v2.0.2
	github.com/swaggo/swag v1.16.6
	github.com/theupdateframework/go-tuf/v2 v2.4.2
	github.com/zalando/go-keyring v0.2.8
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.72.0
	go.opentelemetry.io/otel v1.47.0
	go.opentelemetry.io/otel/trace v1.47.0
	golang.org/x/crypto v0.59.0
	golang.org/x/mod v0.43.0
	golang.org/x/sync v0.25.0
	golang.org/x/sys v0.50.0
	google.golang.org/protobuf v1.36.12
	modernc.org/sqlite v1.62.0
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/Microsoft/go-winio v0.6.4 // indirect
	github.com/ProjectZKM/Ziren/crates/go-runtime/zkvm_runtime v0.0.0-20261104004426-a38b73404a2c // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/aws/aws-sdk-go-v2 v1.48.0 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.27 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.21.3 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.12 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.12 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.12 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.25 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.12 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.12 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.116.0 // indirect
	github.com/aws/smithy-go v1.28.9 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.29.0 // indirect
	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/consensys/gnark-crypto v0.22.0 // indirect
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
	github.com/cpuguy83/go-md2man/v2 v2.0.7 // indirect
	github.com/crate-crypto/go-eth-kzg v1.5.0 // indirect
	github.com/danieljoos/wincred v1.2.3 // indirect
	github.com/deckarep/golang-set/v2 v2.9.0 // indirect
	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.1 // indirect
	github.com/docker/cli v29.9.3+incompatible // indirect
	github.com/docker/docker-credential-helpers v0.9.13 // indirect
	github.com/dustin/go-humanize v1.1.0 // indirect
	github.com/ebitengine/purego v0.11.3 // indirect
	github.com/ethereum/c-kzg-4844/v2 v2.1.8 // indirect
	github.com/felixge/httpsnoop v1.1.0 // indirect
	github.com/fjl/jsonw v0.1.0 // indirect
	github.com/florianl/go-nfqueue/v2 v2.1.0 // indirect
	github.com/fsnotify/fsnotify v1.10.1 // indirect
	github.com/go-logr/logr v1.4.4 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/go-openapi/jsonpointer v1.0.2 // indirect
	github.com/go-openapi/jsonreference v1.0.3 // indirect
	github.com/go-openapi/spec v1.0.1 // indirect
	github.com/go-openapi/swag/conv v0.29.2 // indirect
	github.com/go-openapi/swag/jsonutils v0.29.2 // indirect
	github.com/go-openapi/swag/loading v0.29.2 // indirect
	github.com/go-openapi/swag/pools v0.29.2 // indirect
	github.com/go-openapi/swag/stringutils v0.29.2 // indirect
	github.com/go-openapi/swag/typeutils v0.29.2 // indirect
	github.com/go-openapi/swag/yamlutils v0.29.2 // indirect
	github.com/go-openapi/testify/enable/yaml/v2 v2.8.1 // indirect
	github.com/gofrs/flock v0.13.2 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/nftables v0.3.0 // indirect
	github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510 // indirect
	github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.33.0 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/holiman/uint256 v1.3.2 // indirect
	github.com/in-toto/attestation v1.2.0 // indirect
	github.com/in-toto/in-toto-golang v0.11.0 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/klauspost/pgzip v1.3.0 // indirect
	github.com/libp2p/go-buffer-pool v0.1.0 // indirect
	github.com/libp2p/go-yamux/v5 v5.1.0 // indirect
	github.com/lmittmann/tint v1.2.1 // indirect
	github.com/lufia/plan9stats v0.0.0-20261101121723-be84dd9509a0 // indirect
	github.com/mattn/go-isatty v0.0.24 // indirect
	github.com/mdlayher/netlink v1.11.2 // indirect
	github.com/mdlayher/socket v0.8.0 // indirect
	github.com/mdlayher/vsock v1.4.0 // indirect
	github.com/miekg/dns v1.1.73 // indirect
	github.com/moby/buildkit v0.35.0 // indirect
	github.com/moby/locker v1.0.1 // indirect
	github.com/moby/patternmatcher v0.6.1 // indirect
	github.com/moby/sys/signal v0.7.1 // indirect
	github.com/morikuni/aec v1.1.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/ncruces/go-strftime v1.1.0 // indirect
	github.com/oapi-codegen/runtime v1.9.0 // indirect
	github.com/opencontainers/image-spec v1.1.1 // indirect
	github.com/pandatix/go-abnf v0.5.5 // indirect
	github.com/pelletier/go-toml/v2 v2.4.3 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
	github.com/power-devops/perfstat v0.0.0-20260916203055-22a1a467d9f0 // indirect
	github.com/prometheus/client_model v0.6.3 // indirect
	github.com/prometheus/common v0.74.0 // indirect
	github.com/prometheus/procfs v0.23.0 // indirect
	github.com/quic-go/quic-go v0.65.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/secure-systems-lab/go-securesystemslib v0.11.1 // indirect
	github.com/shibumi/go-pathspec v1.3.0 // indirect
	github.com/shirou/gopsutil v3.21.11+incompatible // indirect
	github.com/sigstore/protobuf-specs v0.5.2 // indirect
	github.com/sirupsen/logrus v1.10.2 // indirect
	github.com/supranational/blst v0.3.17 // indirect
	github.com/swaggo/files/v2 v2.0.2 // indirect
	github.com/tklauser/go-sysconf v0.4.0 // indirect
	github.com/tklauser/numcpus v0.12.0 // indirect
	github.com/tonistiigi/fsutil v0.0.0-20261103125000-e075fd9305eb // indirect
	github.com/tonistiigi/go-csvvalue v0.0.0-20240814133006-030d3b2625d0 // indirect
	github.com/tonistiigi/units v0.0.0-20180711220420-6950e57a87ea // indirect
	github.com/tonistiigi/vt100 v0.0.0-20240514184818-90bafcd6abab // indirect
	github.com/urfave/cli/v2 v2.27.7 // indirect
	github.com/vishvananda/netlink v1.3.1 // indirect
	github.com/vishvananda/netns v0.0.5 // indirect
	github.com/xrash/smetrics v0.0.0-20261013231157-39c47d93efba // indirect
	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	go.mongodb.org/mongo-driver v1.17.10 // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.72.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.72.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.47.0 // indirect
	go.opentelemetry.io/otel/log v1.47.0 // indirect
	go.opentelemetry.io/otel/metric v1.47.0 // indirect
	go.opentelemetry.io/otel/sdk v1.47.0 // indirect
	go.opentelemetry.io/proto/otlp v1.11.1 // indirect
	go.yaml.in/yaml/v2 v2.4.5 // indirect
	go.yaml.in/yaml/v3 v3.0.6 // indirect
	golang.org/x/net v0.62.0 // indirect
	golang.org/x/term v0.48.0 // indirect
	golang.org/x/text v0.44.0 // indirect
	golang.org/x/time v0.16.0 // indirect
	golang.org/x/tools v0.52.1-0.20261106145633-d407941a339a // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20261110000943-09e21b237f2c // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20261110000943-09e21b237f2c // indirect
	google.golang.org/grpc v1.85.0 // indirect
	modernc.org/libc v1.81.0 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.12.1 // indirect
	sigs.k8s.io/yaml v1.6.0 // indirect
)

replace github.com/snapflowio/common-go => ../../libs/common-go

replace github.com/snapflowio/tunnel-go => ../../libs/tunnel-go

tool github.com/swaggo/swag/cmd/swag
