import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { DatabaseService } from "../database/database.service";
import { InjectDb, InjectRepository } from "../database/decorators/inject-repository.decorator";
import { User } from "../database/schema";
import { UserEvents } from "./constants/user-events.constant";
import { CreateUserDto } from "./dto/create-user.dto";
import { UserCreatedEvent } from "./events/user-created.event";
import { UserDeletedEvent } from "./events/user-deleted.event";
import { UserRepository } from "./repositories/user.repository";

/**
 * Service responsible for user-related business logic and data manipulation.
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserRepository)
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
    @InjectDb()
    private readonly databaseService: DatabaseService
  ) {}

  /**
   * Retrieves all users from the database.
   * @returns A promise that resolves to an array of User entities.
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  /**
   * Finds multiple users by their IDs.
   * @param ids - An array of user IDs to search for.
   * @returns A promise that resolves to an array of found User entities.
   */
  async findByIds(ids: string[]): Promise<User[]> {
    return this.userRepository.findByIds(ids);
  }

  /**
   * Finds a single user by their ID.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity or null if not found.
   */
  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Finds a single user by their ID or throws an exception if not found.
   * @param id - The ID of the user to find.
   * @returns A promise that resolves to the User entity.
   * @throws {NotFoundException} If no user is found with the given ID.
   */
  async findOneOrFail(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
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
    return this.userRepository.findByEmail(email);
  }

  /**
   * Removes a user from the database in a transaction.
   * Emits a user deletion event.
   * @param id - The ID of the user to remove.
   * @returns A promise that resolves when the operation is complete.
   */
  async remove(id: string): Promise<void> {
    const deleted = await this.userRepository.delete(id);
    if (deleted) {
      await this.eventEmitter.emitAsync(
        UserEvents.DELETED,
        new UserDeletedEvent(this.databaseService.db, id)
      );
    }
  }

  /**
   * Creates a new user in a transaction.
   * Emits a user creation event.
   * @param createUserDto - The data transfer object containing user details.
   * @returns A promise that resolves to the newly created User entity.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.create(createUserDto);

    await this.eventEmitter.emitAsync(
      UserEvents.CREATED,
      new UserCreatedEvent(
        this.databaseService.db,
        user.id,
        createUserDto.email,
        createUserDto.emailVerified
      )
    );

    return user;
  }

  /**
   * Updates the email of a specific user.
   * @param userId - The ID of the user to update.
   * @param email - The new email for the user.
   * @returns A promise that resolves to the updated User entity.
   */
  async updateEmail(userId: string, email: string): Promise<User> {
    const user = await this.userRepository.updateEmail(userId, email);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    return user;
  }
}
