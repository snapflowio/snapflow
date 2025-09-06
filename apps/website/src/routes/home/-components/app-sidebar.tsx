import { useListWorkspaces } from "@/api/queries";
import {
    Cards01Icon,
    Comment01Icon,
    HelpCircleIcon,
    Home03Icon,
    NotebookIcon,
    PlusSignIcon,
    UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Logo,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    Skeleton,
} from "@snapflow/ui";
import { Link } from "@tanstack/react-router";

const staticLinks = [
  {
    icon: <HugeiconsIcon icon={Home03Icon} size={15} />,
    label: "Home",
    href: "/app",
  },
  {
    icon: <HugeiconsIcon icon={UserMultiple02Icon} size={15} />,
    label: "Study Groups",
    href: "/",
  },
  {
    icon: <HugeiconsIcon icon={NotebookIcon} size={15} />,
    label: "Notebooks",
    href: "/",
  },
  {
    icon: <HugeiconsIcon icon={Cards01Icon} size={15} />,
    label: "Flash Cards",
    href: "/",
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data, isLoading } = useListWorkspaces();

  return (
    <Sidebar variant="inset" {...props} className="dark scheme-only-dark max-lg:p-3 lg:pe-1">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-3 pt-4">
          <Logo size={28} />
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 pt-3">
        <SidebarGroup className="flex flex-col gap-2">
          {staticLinks.map(({ icon, label, href }) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton asChild>
                <Link to={href}>
                  {icon} {label}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarGroup>
        <SidebarGroup className="mt-3 px-1">
          <SidebarGroupLabel className="text-muted-foreground/65">Workspaces</SidebarGroupLabel>
          <SidebarGroupAction title="Create Workspace">
            <HugeiconsIcon icon={PlusSignIcon} /> <span className="sr-only">Add Project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <SidebarMenuItem key={`skeleton-${index}`}>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : data && data.length > 0 ? (
                data.map((workspace) => (
                  <SidebarMenuItem key={workspace.id}>
                    <SidebarMenuButton className="font-normal text-foreground">
                      <div
                        className="size-2 rounded-full p-1.5"
                        style={{ backgroundColor: workspace.color }}
                      />
                      {workspace.name}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <SidebarMenuItem>
                  <div className="px-2 py-1.5 text-muted-foreground text-xs">No workspaces yet</div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup className="mb-6 flex flex-col">
          <SidebarMenuButton className="justify-start gap-3 font-normal" asChild>
            <a href={"/"} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={Comment01Icon} size={15} strokeWidth={1.5} /> Feedback
            </a>
          </SidebarMenuButton>
          <SidebarMenuButton className="justify-start gap-3 font-normal" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={HelpCircleIcon} size={15} strokeWidth={1.5} /> Help & Support
            </a>
          </SidebarMenuButton>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
