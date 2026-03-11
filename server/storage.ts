import { users, messages, aiMessages, statuses, type User, type InsertUser, type Message, type AiMessage, type Status } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, ne, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAiUser(): Promise<User | undefined>;

  getMessages(userId1: string, userId2: string): Promise<Message[]>;
  createMessage(msg: { fromUserId: string; toUserId: string; content: string; type?: string; metadata?: unknown }): Promise<Message>;
  markMessagesRead(fromUserId: string, toUserId: string): Promise<void>;
  getConversationPartners(userId: string): Promise<{ user: User; lastMessage: Message | null }[]>;

  getAiMessages(userId: string): Promise<AiMessage[]>;
  createAiMessage(userId: string, role: string, content: string): Promise<AiMessage>;
  clearAiMessages(userId: string): Promise<void>;

  createStatus(userId: string, imageUrl: string, caption?: string): Promise<Status>;
  getStatuses(): Promise<(Status & { user: User })[]>;
  getUserStatuses(userId: string): Promise<Status[]>;
  deleteStatus(id: string, userId: string): Promise<void>;
  deleteExpiredStatuses(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAiUser(): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.isAiUser, true));
    return user;
  }

  async getMessages(userId1: string, userId2: string): Promise<Message[]> {
    return db.select().from(messages).where(
      or(
        and(eq(messages.fromUserId, userId1), eq(messages.toUserId, userId2)),
        and(eq(messages.fromUserId, userId2), eq(messages.toUserId, userId1)),
      )
    ).orderBy(messages.createdAt);
  }

  async createMessage(msg: { fromUserId: string; toUserId: string; content: string; type?: string; metadata?: unknown }): Promise<Message> {
    const [created] = await db.insert(messages).values({
      fromUserId: msg.fromUserId,
      toUserId: msg.toUserId,
      content: msg.content,
      type: msg.type ?? "text",
      metadata: msg.metadata ?? null,
    }).returning();
    return created;
  }

  async markMessagesRead(fromUserId: string, toUserId: string): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.fromUserId, fromUserId), eq(messages.toUserId, toUserId)));
  }

  async getConversationPartners(userId: string): Promise<{ user: User; lastMessage: Message | null }[]> {
    const allMessages = await db.select().from(messages).where(
      or(eq(messages.fromUserId, userId), eq(messages.toUserId, userId))
    ).orderBy(desc(messages.createdAt));

    const partnerIds = new Set<string>();
    const lastMessages = new Map<string, Message>();

    for (const msg of allMessages) {
      const partnerId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      if (!partnerIds.has(partnerId)) {
        partnerIds.add(partnerId);
        lastMessages.set(partnerId, msg);
      }
    }

    const result: { user: User; lastMessage: Message | null }[] = [];
    for (const partnerId of partnerIds) {
      const user = await this.getUser(partnerId);
      if (user) {
        result.push({ user, lastMessage: lastMessages.get(partnerId) ?? null });
      }
    }
    return result;
  }

  async getAiMessages(userId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages).where(eq(aiMessages.userId, userId)).orderBy(aiMessages.createdAt);
  }

  async createAiMessage(userId: string, role: string, content: string): Promise<AiMessage> {
    const [created] = await db.insert(aiMessages).values({ userId, role, content }).returning();
    return created;
  }

  async clearAiMessages(userId: string): Promise<void> {
    await db.delete(aiMessages).where(eq(aiMessages.userId, userId));
  }

  async createStatus(userId: string, imageUrl: string, caption?: string): Promise<Status> {
    const [created] = await db.insert(statuses).values({ userId, imageUrl, caption: caption ?? null }).returning();
    return created;
  }

  async getStatuses(): Promise<(Status & { user: User })[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allStatuses = await db.select().from(statuses)
      .where(sql`${statuses.createdAt} > ${twentyFourHoursAgo}`)
      .orderBy(desc(statuses.createdAt));

    const result: (Status & { user: User })[] = [];
    for (const status of allStatuses) {
      const user = await this.getUser(status.userId);
      if (user) {
        result.push({ ...status, user });
      }
    }
    return result;
  }

  async getUserStatuses(userId: string): Promise<Status[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return db.select().from(statuses)
      .where(and(eq(statuses.userId, userId), sql`${statuses.createdAt} > ${twentyFourHoursAgo}`))
      .orderBy(desc(statuses.createdAt));
  }

  async deleteStatus(id: string, userId: string): Promise<void> {
    await db.delete(statuses).where(and(eq(statuses.id, id), eq(statuses.userId, userId)));
  }

  async deleteExpiredStatuses(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleted = await db.delete(statuses)
      .where(sql`${statuses.createdAt} <= ${twentyFourHoursAgo}`)
      .returning();
    return deleted.length;
  }
}

export const storage = new DatabaseStorage();
