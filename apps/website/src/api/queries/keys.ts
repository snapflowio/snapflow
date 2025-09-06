/**
 * Query key factory for consistent query key management
 * This ensures proper caching and invalidation across the app
 */
export const queryKeys = {
  // User queries
  users: {
    all: ["users"] as const,
    me: () => [...queryKeys.users.all, "me"] as const,
    byId: (id: string) => [...queryKeys.users.all, "id", id] as const,
  },

  // Workspace queries
  workspaces: {
    all: ["workspaces"] as const,
    list: () => [...queryKeys.workspaces.all, "list"] as const,
    byId: (id: string) => [...queryKeys.workspaces.all, "id", id] as const,
  },
} as const;
