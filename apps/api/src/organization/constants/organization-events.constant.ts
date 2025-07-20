export const OrganizationEvents = {
  INVITATION_CREATED: "invitation.created",
  INVITATION_ACCEPTED: "invitation.accepted",
  INVITATION_DECLINED: "invitation.declined",
  INVITATION_CANCELLED: "invitation.cancelled",
  CREATED: "organization.created",
  SUSPENDED_SANDBOX_STOPPED: "organization.suspended-sandbox-stopped",
  SUSPENDED_IMAGE_RUNNER_REMOVED: "organization.suspended-image-manager-removed",
} as const;
