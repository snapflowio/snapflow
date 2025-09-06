import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { WorkspaceInvitationStatus } from "../workspace/enums/workspace-invitation-status.enum";
import { WorkspaceMemberRole } from "../workspace/enums/workspace-member-role.enum";

type EnumToPgEnum<T extends Record<string, string>> = [T[keyof T], ...T[keyof T][]];

function enumToPgEnum<T extends Record<string, string>>(enumObject: T): EnumToPgEnum<T> {
  return Object.values(enumObject) as EnumToPgEnum<T>;
}

export const workspaceMemberRole = pgEnum(
  "workspace_member_role",
  enumToPgEnum(WorkspaceMemberRole)
);

export const workspaceInvitationStatus = pgEnum(
  "workspace_invitation_status",
  enumToPgEnum(WorkspaceInvitationStatus)
);

export const user = pgTable("user", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const account = pgTable("account", {
  id: uuid("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: date("access_token_expires_at"),
  refreshTokenExpiresAt: date("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable("session", {
  id: uuid("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull(),
});

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  classCode: text("class_code").default(""),
  color: text("color").notNull().default("#53eafd"),
  suspended: boolean("suspended").notNull().default(false),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  suspendedUntil: timestamp("suspended_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const workspaceUser = pgTable(
  "workspace_user",
  {
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: workspaceMemberRole("role").default(WorkspaceMemberRole.MEMBER),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })]
);

export const workspaceInvitation = pgTable("workspace_invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  email: text("email").notNull(),
  invitedBy: uuid("invited_by"),
  role: workspaceMemberRole("role").default(WorkspaceMemberRole.MEMBER),
  expiresAt: timestamp("expires_at").notNull(),
  status: workspaceInvitationStatus("status").default(WorkspaceInvitationStatus.PENDING),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(user, ({ many }) => ({
  workspaces: many(workspace),
  workspaceUsers: many(workspaceUser),
}));

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  owner: one(user, {
    fields: [workspace.userId],
    references: [user.id],
  }),
  users: many(workspaceUser),
  invitations: many(workspaceInvitation),
}));

export const workspaceUserRelations = relations(workspaceUser, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceUser.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [workspaceUser.userId],
    references: [user.id],
  }),
}));

export const workspaceInvitationRelations = relations(workspaceInvitation, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceInvitation.workspaceId],
    references: [workspace.id],
  }),
}));

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;

export type WorkspaceUser = typeof workspaceUser.$inferSelect;
export type NewWorkspaceUser = typeof workspaceUser.$inferInsert;

export type WorkspaceInvitation = typeof workspaceInvitation.$inferSelect;
export type NewWorkspaceInvitation = typeof workspaceInvitation.$inferInsert;
export type WorkspaceInvitationWithWorkspace = WorkspaceInvitation & {
  workspace: Workspace;
};
