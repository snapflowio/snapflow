export const config = {
  production: process.env.NODE_ENV === "production",
  port: Number.parseInt(process.env.PORT, 10),
  appUrl: process.env.APP_URL,
  betterAuth: {
    baseUrl: process.env.BETTER_AUTH_BASE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
  },
  database: {
    host: process.env.DATABASE_HOST,
    port: Number.parseInt(process.env.DATABASE_PORT || "5432", 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    secure: process.env.SMTP_SECURE === "true",
    from: process.env.SMTP_EMAIL_FROM || "noreply@mail.snapflow.gg",
  },
  dashboardUrl: process.env.DASHBOARD_URL,
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    defaultBucket: process.env.S3_DEFAULT_BUCKET,
  },
  maintananceMode: process.env.MAINTENANCE_MODE === "true",
};
