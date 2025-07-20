import { CreateOrganizationQuotaDto } from "../../organization/dto/create-organization-quota.dto";

export const DEFAULT_ORGANIZATION_QUOTA: CreateOrganizationQuotaDto = {
  totalCpuQuota: 10,
  totalMemoryQuota: 10,
  totalDiskQuota: 30,
  maxCpuPerSandbox: 4,
  maxMemoryPerSandbox: 8,
  maxDiskPerSandbox: 10,
  imageQuota: 100,
  maxImageSize: 20,
  bucketQuota: 100,
};
