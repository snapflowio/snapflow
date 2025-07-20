import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { UserEvents } from "./constants/user-events.constant";
import { CreateUserDto } from "./dto/create-user.dto";
import { SystemRole } from "./enums/system-role.enum";
import { UserCreatedEvent } from "./events/user-created.event";
import { UserDeletedEvent } from "./events/user-deleted.event";
import { UserEmailVerifiedEvent } from "./events/user-email-verified.event";
import { User } from "./user.entity";

/**
 * Service responsible for user-related business logic and data manipulation.
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Retrieves all users from the database.
   * @returns A promise that resolves to an array of User entities.
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
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

    return this.userRepository.find({
      where: {
        id: In(ids),
      },
    });
  }

  /**
   * Finds a single user by their ID.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity or null if not found.
   */
  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Finds a single user by their ID or throws an exception if not found.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity.
   * @throws {NotFoundException} If no user is found with the given ID.
   */
  async findOneOrFail(id: string): Promise<User> {
    return this.userRepository.findOneOrFail({ where: { id } });
  }

  /**
   * Finds a single user by their email address.
   * @param email - The email of the user to find.
   * @returns A promise that resolves to the User entity or null if not found.
   */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Removes a user from the database in a transaction.
   * Emits a user deletion event.
   * @param id - The ID of the user to remove.
   * @returns A promise that resolves when the operation is complete.
   */
  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.delete(User, id);
      await this.eventEmitter.emitAsync(
        UserEvents.DELETED,
        new UserDeletedEvent(transactionalEntityManager, id)
      );
    });
  }

  /**
   * Creates a new user in a transaction.
   * Emits a user creation event.
   * @param createUserDto - The data transfer object containing user details.
   * @returns A promise that resolves to the newly created User entity.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Use the repository's create method to build the entity from the DTO.
    const user = this.userRepository.create(createUserDto);

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(user);
      await this.eventEmitter.emitAsync(
        UserEvents.CREATED,
        new UserCreatedEvent(
          transactionalEntityManager,
          user.id,
          createUserDto.email,
          createUserDto.emailVerified,
          createUserDto.personalOrganizationQuota
        )
      );
    });

    return user;
  }

  /**
   * Updates the name of a specific user.
   * @param userId - The ID of the user to update.
   * @param name - The new name for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateName(userId: string, name: string): Promise<User> {
    const user = await this.findUserByIdOrFail(userId);
    user.name = name;
    return this.userRepository.save(user);
  }

  /**
   * Updates the email of a specific user.
   * @param userId - The ID of the user to update.
   * @param email - The new email for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateEmail(userId: string, email: string): Promise<User> {
    const user = await this.findUserByIdOrFail(userId);
    user.email = email;
    return this.userRepository.save(user);
  }

  /**
   * Updates the email verification status of a specific user.
   * @param userId - The ID of the user to update.
   * @param verified - The new email verification status.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateEmailVerified(userId: string, verified: boolean): Promise<User> {
    const user = await this.findUserByIdOrFail(userId);
    user.emailVerified = verified;
    return this.userRepository.save(user);
  }

  /**
   * Updates the system role of a specific user.
   * @param userId - The ID of the user to update.
   * @param role - The new system role for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateRole(userId: string, role: SystemRole): Promise<User> {
    const user = await this.findUserByIdOrFail(userId);
    user.role = role;
    return this.userRepository.save(user);
  }

  /**
   * Sets the user's email verification status in a transaction.
   * If status is set to true, it emits an email verification event.
   * @param userId - The ID of the user to verify.
   * @param emailVerified - The verification status to set.
   * @returns A promise that resolves to the updated User entity.
   */
  async verifyEmail(userId: string, emailVerified: boolean): Promise<User> {
    const user = await this.findUserByIdOrFail(userId);
    user.emailVerified = emailVerified;

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(user);
      if (emailVerified) {
        await this.eventEmitter.emitAsync(
          UserEvents.EMAIL_VERIFIED,
          new UserEmailVerifiedEvent(transactionalEntityManager, user.id)
        );
      }
    });

    return user;
  }

  /**
   * A private helper to find a user by ID or throw a NotFoundException.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity.
   * @throws {NotFoundException} If the user is not found.
   */
  private async findUserByIdOrFail(id: string): Promise<User> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
    return user;
  }
}
