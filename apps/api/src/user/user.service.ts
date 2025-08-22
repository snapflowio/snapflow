import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { User } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { UserEvents } from "./constants/user-events.constant";
import { CreateUserDto } from "./dto/create-user.dto";
import { SystemRole } from "./enums/system-role.enum";
import { UserCreatedEvent } from "./events/user-created.event";
import { UserDeletedEvent } from "./events/user-deleted.event";
import { UserEmailVerifiedEvent } from "./events/user-email-verified.event";

/**
 * Service responsible for user-related business logic and data manipulation.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Retrieves all users from the database.
   * @returns A promise that resolves to an array of User entities.
   */
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  /**
   * Finds multiple users by their IDs.
   * @param ids - An array of user IDs to search for.
   * @returns A promise that resolves to an array of found User entities.
   */
  async findByIds(ids: string[]): Promise<User[]> {
    // Avoid an unnecessary database query if the IDs array is empty.
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  /**
   * Finds a single user by their ID.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity or null if not found.
   */
  async findOne(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Finds a single user by their ID or throws an exception if not found.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity.
   * @throws {NotFoundException} If no user is found with the given ID.
   */
  async findOneOrFail(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  /**
   * Finds a single user by their email address.
   * @param email - The email of the user to find.
   * @returns A promise that resolves to the User entity or null if not found.
   */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email } });
  }

  /**
   * Removes a user from the database in a transaction.
   * Emits a user deletion event.
   * @param id - The ID of the user to remove.
   * @returns A promise that resolves when the operation is complete.
   */
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      await prisma.user.delete({ where: { id } });
      await this.eventEmitter.emitAsync(UserEvents.DELETED, new UserDeletedEvent(prisma, id));
    });
  }

  /**
   * Creates a new user in a transaction.
   * Emits a user creation event.
   * @param createUserDto - The data transfer object containing user details.
   * @returns A promise that resolves to the newly created User entity.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    let user: User;

    await this.prisma.$transaction(async (prisma) => {
      user = await prisma.user.create({
        data: {
          id: createUserDto.id,
          name: createUserDto.name,
          email: createUserDto.email || "",
          emailVerified: createUserDto.emailVerified || false,
          role: createUserDto.role || SystemRole.USER,
        },
      });

      await this.eventEmitter.emitAsync(
        UserEvents.CREATED,
        new UserCreatedEvent(
          prisma,
          user.id,
          createUserDto.email,
          createUserDto.emailVerified,
          createUserDto.personalOrganizationQuota
        )
      );
    });

    return user!;
  }

  /**
   * Updates the name of a specific user.
   * @param userId - The ID of the user to update.
   * @param name - The new name for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateName(userId: string, name: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });
  }

  /**
   * Updates the email of a specific user.
   * @param userId - The ID of the user to update.
   * @param email - The new email for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateEmail(userId: string, email: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { email },
    });
  }

  /**
   * Updates the email verification status of a specific user.
   * @param userId - The ID of the user to update.
   * @param verified - The new email verification status.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateEmailVerified(userId: string, verified: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: verified },
    });
  }

  /**
   * Updates the system role of a specific user.
   * @param userId - The ID of the user to update.
   * @param role - The new system role for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateRole(userId: string, role: SystemRole): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  /**
   * Sets the user's email verification status in a transaction.
   * If status is set to true, it emits an email verification event.
   * @param userId - The ID of the user to verify.
   * @param emailVerified - The verification status to set.
   * @returns A promise that resolves to the updated User entity.
   */
  async verifyEmail(userId: string, emailVerified: boolean): Promise<User> {
    let user: User;

    await this.prisma.$transaction(async (prisma) => {
      user = await prisma.user.update({
        where: { id: userId },
        data: { emailVerified },
      });

      if (emailVerified) {
        await this.eventEmitter.emitAsync(
          UserEvents.EMAIL_VERIFIED,
          new UserEmailVerifiedEvent(prisma, user.id)
        );
      }
    });

    return user!;
  }
}
