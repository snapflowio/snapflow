"use client";

import { useCallback, useEffect, useState } from "react";
import { UsageOverview } from "@snapflow/api-client";
import {
  Activity,
  Box,
  Cpu,
  Database,
  HardDrive,
  Key,
  MemoryStick,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { handleApiError } from "@/lib/errors";
import { Path } from "@/constants/paths";
import { useApi } from "@/hooks/use-api";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

function MetricCard({
  title,
  current,
  total,
  unit,
  icon: Icon,
  trend,
}: {
  title: string;
  current: number;
  total: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const isHighUsage = percentage > 80;
  const isMediumUsage = percentage > 60;

  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="font-medium text-foreground text-sm">{title}</CardTitle>
        <div className="rounded-full bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-6">
        <div className="mb-4">
          <div className="font-bold text-3xl text-foreground">
            {current.toFixed(1)}
            <span className="ml-1 font-normal text-lg text-muted-foreground">{unit}</span>
          </div>
          <div className="mt-1 text-muted-foreground text-sm">
            of {total.toFixed(1)} {unit} available
          </div>
        </div>
        <div className="space-y-3">
          <Progress
            value={percentage}
            className={`h-2 ${
              isHighUsage
                ? "[&>div]:bg-red-500"
                : isMediumUsage
                  ? "[&>div]:bg-yellow-500"
                  : "[&>div]:bg-green-500"
            }`}
          />
          {percentage > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-medium ${
                  isHighUsage
                    ? "text-red-600"
                    : isMediumUsage
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {percentage.toFixed(1)}% used
              </span>
              {trend && <span className="text-green-600">{trend}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  buttonText,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  buttonText: string;
}) {
  return (
    <Card className="group flex h-full flex-col transition-all duration-200 hover:border-primary/20 hover:shadow-lg">
      <CardHeader className="flex-1 pb-4">
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-primary/10 p-2 transition-colors group-hover:bg-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="font-semibold text-lg">{title}</CardTitle>
        </div>
        <CardDescription className="min-h-[2.5rem] text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <Link href={href}>
          <Button
            className="w-full transition-all duration-200 hover:scale-[1.02]"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  const { organizationsApi } = useApi();
  const { selectedOrganization } = useSelectedOrganization();
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!selectedOrganization) return;

    setLoadingUsage(true);
    try {
      const response = await organizationsApi.getOrganizationUsageOverview(selectedOrganization.id);
      setUsage(response.data);
    } catch (error) {
      handleApiError(error, "Failed to fetch usage overview");
    } finally {
      setLoadingUsage(false);
    }
  }, [organizationsApi, selectedOrganization]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="space-y-10">
      {/* Usage Overview */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="font-semibold text-2xl text-foreground">Resource Usage</h2>
        </div>
        {loadingUsage ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-0 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-8 w-8 rounded-full bg-muted" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-2 h-8 w-20 rounded bg-muted" />
                  <div className="mb-3 h-3 w-32 rounded bg-muted" />
                  <div className="h-2 w-full rounded bg-muted" />
                  <div className="mt-2 h-3 w-16 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : usage ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="CPU Usage"
              current={usage.currentCpuUsage}
              total={usage.totalCpuQuota}
              unit="vCPU"
              icon={Cpu}
            />
            <MetricCard
              title="Memory Usage"
              current={usage.currentMemoryUsage}
              total={usage.totalMemoryQuota}
              unit="GB"
              icon={MemoryStick}
            />
            <MetricCard
              title="Disk Usage"
              current={usage.currentDiskUsage}
              total={usage.totalDiskQuota}
              unit="GB"
              icon={HardDrive}
            />
            <Card className="transition-all duration-200 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="font-medium text-foreground text-sm">GPU Quota</CardTitle>
                <div className="rounded-full bg-muted p-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-6">
                <div className="mb-4">
                  <div className="font-bold text-3xl text-foreground">
                    {usage.totalGpuQuota.toFixed(0)}
                    <span className="ml-1 font-normal text-lg text-muted-foreground">units</span>
                  </div>
                  <div className="mt-1 text-muted-foreground text-sm">GPU units available</div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Activity className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                <div className="font-medium text-destructive text-lg">
                  Unable to load usage data
                </div>
                <div className="text-muted-foreground text-sm">Please try refreshing the page</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-green-500/10 p-2">
            <Plus className="h-5 w-5 text-green-600" />
          </div>
          <h2 className="font-semibold text-2xl text-foreground">Quick Actions</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            title="Create Sandbox"
            description="Spin up a new sandbox environment for development"
            icon={Box}
            href={Path.SANDBOXES}
            buttonText="New Sandbox"
          />
          <QuickActionCard
            title="Build Image"
            description="Create a new custom image for your sandboxes"
            icon={Database}
            href={Path.IMAGES}
            buttonText="New Image"
          />
          <QuickActionCard
            title="Generate API Key"
            description="Create API keys for programmatic access"
            icon={Key}
            href={Path.API_KEYS}
            buttonText="New API Key"
          />
          {!selectedOrganization?.personal && (
            <QuickActionCard
              title="Invite Members"
              description="Add team members to your organization"
              icon={Users}
              href={Path.MEMBERS}
              buttonText="Invite Member"
            />
          )}
        </div>
      </div>

      {/* Recent Activity placeholder */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-purple-500/10 p-2">
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="font-semibold text-2xl text-foreground">Recent Activity</h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-6 rounded-full bg-muted p-4">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 font-medium text-foreground text-lg">
                Activity tracking coming soon
              </h3>
              <p className="max-w-md text-muted-foreground text-sm">
                Track sandbox usage, API calls, and team activities in real-time
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
