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

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];

    return this.userRepository.find({
      where: {
        id: In(ids),
      },
    });
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findOneOrFail(id: string): Promise<User> {
    return this.userRepository.findOneOrFail({ where: { id } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      await em.delete(User, id);
      await this.eventEmitter.emitAsync(
        UserEvents.DELETED,
        new UserDeletedEvent(em, id),
      );
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    let user = new User();
    user.id = createUserDto.id;
    user.name = createUserDto.name;
    user.password = createUserDto.password;
    user.emailVerified = createUserDto.emailVerified;

    if (createUserDto.email) user.email = createUserDto.email;
    if (createUserDto.role) user.role = createUserDto.role;

    await this.dataSource.transaction(async (em) => {
      user = await em.save(user);
      await this.eventEmitter.emitAsync(
        UserEvents.CREATED,
        new UserCreatedEvent(
          em,
          user.id,
          createUserDto.email,
          createUserDto.emailVerified,
          createUserDto.personalOrganizationQuota,
        ),
      );
    });

    return user;
  }

  async updateName(userId: string, name: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found.`);

    user.name = name;
    return this.userRepository.save(user);
  }

  async updateEmail(userId: string, email: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found.`);

    user.email = email;
    return this.userRepository.save(user);
  }

  async updateEmailVerified(userId: string, verified: boolean): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found.`);

    user.emailVerified = verified;
    return this.userRepository.save(user);
  }

  async updateRole(userId: string, role: SystemRole): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found.`);

    user.role = role;
    return this.userRepository.save(user);
  }

  async verifyEmail(userId: string, emailVerified: boolean): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found.`);

    user.emailVerified = emailVerified;
    await this.dataSource.transaction(async (em) => {
      await em.save(user);
      if (emailVerified) {
        await this.eventEmitter.emitAsync(
          UserEvents.EMAIL_VERIFIED,
          new UserEmailVerifiedEvent(em, user.id),
        );
      }
    });

    return user;
  }
}
