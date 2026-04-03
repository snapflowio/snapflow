CREATE TABLE "user" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    email           VARCHAR NOT NULL UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    image           VARCHAR,
    role            TEXT NOT NULL DEFAULT 'user',
    banned          BOOLEAN NOT NULL DEFAULT false,
    ban_reason      VARCHAR,
    ban_expires     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE account (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    account_id                VARCHAR NOT NULL,
    provider_id               VARCHAR NOT NULL,
    access_token              VARCHAR,
    refresh_token             VARCHAR,
    access_token_expires_at   TIMESTAMPTZ,
    refresh_token_expires_at  TIMESTAMPTZ,
    scope                     VARCHAR,
    id_token                  VARCHAR,
    password                  VARCHAR,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_account_user_id ON account(user_id);

CREATE TABLE verification (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier  VARCHAR NOT NULL,
    value       VARCHAR NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_token (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token_hash      VARCHAR NOT NULL UNIQUE,
    jti             VARCHAR NOT NULL UNIQUE,
    ip_address      VARCHAR,
    user_agent      VARCHAR,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT false,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_token_user_id ON refresh_token(user_id);
CREATE INDEX idx_refresh_token_jti ON refresh_token(jti);
CREATE INDEX idx_refresh_token_expires_at ON refresh_token(expires_at);
CREATE INDEX idx_refresh_token_revoked ON refresh_token(revoked) WHERE revoked = false;

CREATE TABLE organization (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   VARCHAR NOT NULL,
    created_by             UUID NOT NULL,
    personal               BOOLEAN NOT NULL DEFAULT false,
    telemetry_enabled      BOOLEAN NOT NULL DEFAULT true,
    total_cpu_quota        INTEGER NOT NULL DEFAULT 6,
    total_memory_quota     INTEGER NOT NULL DEFAULT 1536,
    total_disk_quota       INTEGER NOT NULL DEFAULT 6,
    max_cpu_per_sandbox    INTEGER NOT NULL DEFAULT 2,
    max_memory_per_sandbox INTEGER NOT NULL DEFAULT 512,
    max_disk_per_sandbox   INTEGER NOT NULL DEFAULT 2,
    max_image_size         INTEGER NOT NULL DEFAULT 20,
    image_quota            INTEGER NOT NULL DEFAULT 5,
    bucket_quota           INTEGER NOT NULL DEFAULT 3,
    wallet_balance         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    suspended              BOOLEAN NOT NULL DEFAULT false,
    suspended_at           TIMESTAMPTZ,
    suspension_reason      VARCHAR,
    suspended_until        TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_user (
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    role            TEXT NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX idx_organization_user_user_id ON organization_user(user_id);

CREATE TABLE organization_role (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    description     VARCHAR NOT NULL DEFAULT '',
    permissions     TEXT[] NOT NULL DEFAULT '{}',
    is_global       BOOLEAN NOT NULL DEFAULT false,
    organization_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_organization_role_org_id ON organization_role(organization_id);

CREATE TABLE organization_role_assignment (
    organization_id UUID NOT NULL,
    user_id         UUID NOT NULL,
    role_id         UUID NOT NULL REFERENCES organization_role(id) ON DELETE CASCADE,
    PRIMARY KEY (organization_id, user_id, role_id),
    FOREIGN KEY (organization_id, user_id)
        REFERENCES organization_user(organization_id, user_id) ON DELETE CASCADE
);

CREATE TABLE organization_invitation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    email           VARCHAR NOT NULL,
    invited_by      VARCHAR NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'member',
    expires_at      TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_organization_invitation_org_id ON organization_invitation(organization_id);
CREATE INDEX idx_organization_invitation_email ON organization_invitation(email);

CREATE TABLE organization_role_assignment_invitation (
    invitation_id UUID NOT NULL REFERENCES organization_invitation(id) ON DELETE CASCADE,
    role_id       UUID NOT NULL REFERENCES organization_role(id) ON DELETE CASCADE,
    PRIMARY KEY (invitation_id, role_id)
);

CREATE TABLE api_key (
    organization_id UUID NOT NULL,
    user_id         UUID NOT NULL,
    name            VARCHAR NOT NULL,
    key_hash        VARCHAR NOT NULL UNIQUE,
    key_prefix      VARCHAR NOT NULL,
    key_suffix      VARCHAR NOT NULL,
    permissions     TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    PRIMARY KEY (organization_id, user_id, name)
);

CREATE TABLE registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    url             VARCHAR NOT NULL,
    username        VARCHAR NOT NULL,
    password        VARCHAR NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    project         VARCHAR NOT NULL DEFAULT '',
    organization_id UUID,
    registry_type   TEXT NOT NULL DEFAULT 'internal',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE executor (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain                          VARCHAR NOT NULL UNIQUE,
    api_url                         VARCHAR NOT NULL,
    proxy_url                       VARCHAR NOT NULL,
    api_key                         VARCHAR NOT NULL,
    cpu                             INTEGER NOT NULL,
    memory_gib                      INTEGER NOT NULL,
    disk_gib                        INTEGER NOT NULL,
    gpu                             INTEGER NOT NULL,
    gpu_type                        VARCHAR NOT NULL,
    class                           TEXT NOT NULL DEFAULT 'small',
    used                            INTEGER NOT NULL DEFAULT 0,
    capacity                        INTEGER NOT NULL,
    current_cpu_usage_percentage    REAL NOT NULL DEFAULT 0,
    current_memory_usage_percentage REAL NOT NULL DEFAULT 0,
    current_disk_usage_percentage   REAL NOT NULL DEFAULT 0,
    current_allocated_cpu           INTEGER NOT NULL DEFAULT 0,
    current_allocated_memory_gib    INTEGER NOT NULL DEFAULT 0,
    current_allocated_disk_gib      INTEGER NOT NULL DEFAULT 0,
    current_image_count             INTEGER NOT NULL DEFAULT 0,
    availability_score              INTEGER NOT NULL DEFAULT 0,
    region                          VARCHAR NOT NULL,
    state                           TEXT NOT NULL DEFAULT 'initializing',
    version                         VARCHAR NOT NULL DEFAULT '0',
    last_checked                    TIMESTAMPTZ,
    unschedulable                   BOOLEAN NOT NULL DEFAULT false,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE build_info (
    image_ref           VARCHAR PRIMARY KEY,
    dockerfile_content  TEXT,
    context_hashes      TEXT[],
    last_used_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE image (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID,
    general              BOOLEAN NOT NULL DEFAULT false,
    name                 VARCHAR NOT NULL,
    image_name           VARCHAR NOT NULL,
    internal_name        VARCHAR,
    reference_hash       VARCHAR,
    state                TEXT NOT NULL DEFAULT 'pending',
    error_reason         VARCHAR,
    size                 REAL,
    cpu                  INTEGER NOT NULL DEFAULT 2,
    gpu                  INTEGER NOT NULL DEFAULT 0,
    mem                  INTEGER NOT NULL DEFAULT 512,
    disk                 INTEGER NOT NULL DEFAULT 2,
    hide_from_users      BOOLEAN NOT NULL DEFAULT false,
    entrypoint           TEXT[],
    cmd                  TEXT[],
    build_info_image_ref VARCHAR REFERENCES build_info(image_ref),
    build_executor_id    VARCHAR,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at         TIMESTAMPTZ,
    UNIQUE (organization_id, name)
);
CREATE INDEX idx_image_organization_id ON image(organization_id);
CREATE INDEX idx_image_state ON image(state);

CREATE TABLE image_executor (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state         TEXT NOT NULL DEFAULT 'pulling_image',
    error_reason  VARCHAR,
    image_ref     VARCHAR NOT NULL DEFAULT '',
    executor_id   UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sandbox (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL,
    region               VARCHAR NOT NULL DEFAULT 'us',
    executor_id          UUID,
    prev_executor_id     UUID,
    class                TEXT NOT NULL DEFAULT 'small',
    state                TEXT NOT NULL DEFAULT 'unknown',
    desired_state        TEXT NOT NULL DEFAULT 'started',
    image                VARCHAR,
    os_user              VARCHAR NOT NULL,
    error_reason         VARCHAR,
    env                  JSONB NOT NULL DEFAULT '{}',
    public               BOOLEAN NOT NULL DEFAULT false,
    labels               JSONB,
    cpu                  INTEGER NOT NULL DEFAULT 2,
    gpu                  INTEGER NOT NULL DEFAULT 0,
    mem                  INTEGER NOT NULL DEFAULT 512,
    disk                 INTEGER NOT NULL DEFAULT 2,
    buckets              JSONB NOT NULL DEFAULT '[]',
    auto_stop_interval   INTEGER NOT NULL DEFAULT 15,
    auto_archive_interval INTEGER NOT NULL DEFAULT 0,
    auto_delete_interval INTEGER NOT NULL DEFAULT -1,
    pending              BOOLEAN NOT NULL DEFAULT false,
    auth_token           VARCHAR NOT NULL DEFAULT md5(random()::text),
    build_info_image_ref VARCHAR REFERENCES build_info(image_ref),
    node_version         VARCHAR,
    network_block_all    BOOLEAN NOT NULL DEFAULT false,
    network_allow_list   VARCHAR,
    backup_state         TEXT NOT NULL DEFAULT 'none',
    backup_snapshot      VARCHAR,
    backup_registry_id   UUID,
    backup_error_reason  VARCHAR,
    existing_backup_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at     TIMESTAMPTZ,
    last_backup_at       TIMESTAMPTZ
);
CREATE INDEX idx_sandbox_organization_id ON sandbox(organization_id);
CREATE INDEX idx_sandbox_executor_id ON sandbox(executor_id);
CREATE INDEX idx_sandbox_state ON sandbox(state);
CREATE INDEX idx_sandbox_pending ON sandbox(updated_at) WHERE pending = true;
CREATE INDEX idx_sandbox_backup_state ON sandbox(backup_state) WHERE backup_state != 'none';
CREATE INDEX idx_sandbox_needing_backup ON sandbox(state, backup_state) WHERE backup_state = 'none' AND executor_id IS NOT NULL AND state IN ('archiving', 'stopped');

CREATE TABLE bucket (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    created_by      UUID,
    name            VARCHAR NOT NULL,
    state           TEXT NOT NULL DEFAULT 'pending_create',
    size            INTEGER NOT NULL DEFAULT 0,
    error_reason    VARCHAR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    UNIQUE (organization_id, name)
);
CREATE INDEX idx_bucket_organization_id ON bucket(organization_id);

CREATE TABLE warm_pool (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool         INTEGER NOT NULL,
    image        VARCHAR NOT NULL,
    target       VARCHAR NOT NULL DEFAULT 'us',
    cpu          INTEGER NOT NULL,
    mem          INTEGER NOT NULL,
    disk         INTEGER NOT NULL,
    gpu          INTEGER NOT NULL,
    gpu_type     VARCHAR NOT NULL,
    class        TEXT NOT NULL DEFAULT 'small',
    os_user      VARCHAR NOT NULL,
    error_reason VARCHAR,
    env          JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sandbox_usage_period (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id      UUID NOT NULL,
    organization_id UUID NOT NULL,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ,
    cpu             DOUBLE PRECISION NOT NULL,
    gpu             DOUBLE PRECISION NOT NULL,
    mem             DOUBLE PRECISION NOT NULL,
    disk            DOUBLE PRECISION NOT NULL,
    region          VARCHAR NOT NULL,
    billed          BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_usage_sandbox_id ON sandbox_usage_period(sandbox_id);
CREATE INDEX idx_usage_organization_id ON sandbox_usage_period(organization_id);
CREATE INDEX idx_usage_end_at ON sandbox_usage_period(end_at);
CREATE INDEX idx_usage_unbilled ON sandbox_usage_period(billed) WHERE billed = false AND end_at IS NOT NULL;

CREATE TABLE sandbox_usage_period_archive (
    id              UUID PRIMARY KEY,
    sandbox_id      UUID NOT NULL,
    organization_id UUID NOT NULL,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    cpu             DOUBLE PRECISION NOT NULL,
    gpu             DOUBLE PRECISION NOT NULL,
    mem             DOUBLE PRECISION NOT NULL,
    disk            DOUBLE PRECISION NOT NULL,
    region          VARCHAR NOT NULL,
    billed          BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_usage_archive_sandbox_id ON sandbox_usage_period_archive(sandbox_id);
CREATE INDEX idx_usage_archive_organization_id ON sandbox_usage_period_archive(organization_id);
CREATE INDEX idx_usage_archive_start_at ON sandbox_usage_period_archive(start_at);

CREATE TABLE wallet_transaction (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    amount          DOUBLE PRECISION NOT NULL,
    balance_after   DOUBLE PRECISION NOT NULL,
    description     VARCHAR NOT NULL,
    sandbox_id      UUID,
    usage_period_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_tx_organization_id ON wallet_transaction(organization_id);
CREATE INDEX idx_wallet_tx_created_at ON wallet_transaction(created_at);
