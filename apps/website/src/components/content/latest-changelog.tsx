import { allChangelogs } from "contentlayer/generated";
import { Calendar, ExternalLink, Tag } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/util";

const tagColors: Record<string, string> = {
  Feature: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Bug Fix": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Enhancement: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Breaking Change": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Security: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Performance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export function LatestChangelog() {
  const latestChangelog = allChangelogs
    .filter((changelog) => changelog.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (!latestChangelog) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Latest Update</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {formatDate(latestChangelog.date)}
            {latestChangelog.version && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-xs">
                  v{latestChangelog.version}
                </Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <h4 className="font-medium mb-2">{latestChangelog.title}</h4>
        <p className="text-sm text-muted-foreground mb-4">{latestChangelog.description}</p>

        {latestChangelog.tags && latestChangelog.tags.length > 0 && (
          <div className="flex items-center gap-2">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {latestChangelog.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className={`text-xs ${tagColors[tag] || ""}`}>
                  {tag}
                </Badge>
              ))}
              {latestChangelog.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{latestChangelog.tags.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={latestChangelog.slug}>
            Read More
            <ExternalLink className="w-3 h-3 ml-1" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/changelog">View All Updates</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
