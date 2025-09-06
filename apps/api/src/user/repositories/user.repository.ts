import { eq, inArray } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import { Repository } from "../../database/decorators/repository.decorator";
import { BaseRepository } from "../../database/repositories/base.repository";
import { NewUser, User, user } from "../../database/schema";

@Repository("User")
export class UserRepository extends BaseRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService.db);
  }

  async findById(id: string): Promise<User | null> {
    return await this.db.query.user.findFirst({
      where: eq(user.id, id),
    });
  }

  async findAll(): Promise<User[]> {
    return this.db.select().from(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.db.query.user.findFirst({
      where: eq(user.email, email),
    });
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];

    return this.db.select().from(user).where(inArray(user.id, ids));
  }

  async create(data: NewUser): Promise<User> {
    const result = await this.db.insert(user).values(data).returning();

    return result[0];
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const result = await this.db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();

    return result[0] || null;
  }

  async updateEmail(userId: string, email: string): Promise<User | null> {
    return this.update(userId, { email });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(user).where(eq(user.id, id)).returning({ id: user.id });

    return result.length > 0;
  }
}
