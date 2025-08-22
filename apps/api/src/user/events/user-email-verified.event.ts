import type { PrismaClient } from "@prisma/client";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export class UserEmailVerifiedEvent {
  constructor(
    public readonly prisma: PrismaTransaction,
    public readonly userId: string
  ) {}
}
