import { render } from "@react-email/components";
import { InvitationEmail } from "./invitation-email";
import { OTPVerificationEmail } from "./otp-verification-email";
import { ResetPasswordEmail } from "./reset-password-email";

export async function renderOTPEmail(
  otp: string,
  email: string,
  type:
    | "sign-in"
    | "email-verification"
    | "forget-password" = "email-verification",
): Promise<string> {
  return await render(OTPVerificationEmail({ otp, email, type }));
}

export async function renderPasswordResetEmail(
  username: string,
  resetLink: string,
): Promise<string> {
  return await render(
    ResetPasswordEmail({ username, resetLink, updatedDate: new Date() }),
  );
}

export async function renderInvitationEmail(
  inviterName: string,
  organizationName: string,
  inviteLink: string,
  invitedEmail: string,
): Promise<string> {
  return await render(
    InvitationEmail({
      inviterName,
      organizationName,
      inviteLink,
      invitedEmail,
      updatedDate: new Date(),
    }),
  );
}

export function getEmailSubject(
  type:
    | "sign-in"
    | "email-verification"
    | "forget-password"
    | "reset-password"
    | "waitlist-confirmation"
    | "waitlist-approval"
    | "invitation",
): string {
  switch (type) {
    case "sign-in":
      return "Sign in to Sim Studio";
    case "email-verification":
      return "Verify your email for Sim Studio";
    case "forget-password":
      return "Reset your Sim Studio password";
    case "reset-password":
      return "Reset your Sim Studio password";
    case "invitation":
      return "You've been invited to join a team on Sim Studio";
    default:
      return "Sim Studio";
  }
}
