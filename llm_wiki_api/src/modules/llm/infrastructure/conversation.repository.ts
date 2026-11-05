import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MessageRole,
  Prisma,
  type Conversation,
  type Message,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma';

/** Data needed to add a message to a conversation. */
export interface NewMessage {
  role: MessageRole;
  content: string;
  /** Provider name (e.g. "ANTHROPIC"); created in the table if missing. */
  providerName?: string;
  /** Model that generated the answer (LLM messages only). */
  model?: string;
  /** Token usage returned by the provider (any JSON-serializable value). */
  usage?: unknown;
  /** Sources used for the answer: wiki pages, raw files, ... (JSON-serializable). */
  source?: unknown;
}

/** A conversation with its messages, oldest first. */
export type ConversationWithMessages = Conversation & { messages: Message[] };

/** Prisma error code: the record to update/delete does not exist. */
const RECORD_NOT_FOUND = 'P2025';

/**
 * Converts a value to something Prisma accepts in a Json column: drops
 * `undefined` fields (e.g. in the AI SDK usage) and maps "no value" to SQL NULL.
 */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Reads and writes conversations and their messages in the database. */
@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates an empty conversation. */
  createConversation(title: string): Promise<Conversation> {
    return this.prisma.conversation.create({ data: { title } });
  }

  /** Lists all conversations, most recently active first (without messages). */
  findConversations(): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      orderBy: { modifiedAt: 'desc' },
    });
  }

  /** Returns a conversation with all its messages. 404 if it does not exist. */
  async findConversation(id: string): Promise<ConversationWithMessages> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw this.notFound(id);
    }
    return conversation;
  }

  /** Changes the title of a conversation. */
  renameConversation(id: string, title: string): Promise<Conversation> {
    return this.orNotFound(id, () =>
      this.prisma.conversation.update({ where: { id }, data: { title } }),
    );
  }

  /** Deletes a conversation and, by cascade, all its messages. */
  async deleteConversation(id: string): Promise<void> {
    await this.orNotFound(id, () =>
      this.prisma.conversation.delete({ where: { id } }),
    );
  }

  /** Messages of a conversation, oldest first. 404 if it does not exist. */
  async findMessages(conversationId: string): Promise<Message[]> {
    return (await this.findConversation(conversationId)).messages;
  }

  /**
   * Adds a message to a conversation and bumps its `modifiedAt`,
   * in a single transaction. 404 if the conversation does not exist.
   */
  async addMessage(
    conversationId: string,
    { providerName, usage, source, ...message }: NewMessage,
  ): Promise<Message> {
    const [, created] = await this.orNotFound(conversationId, () =>
      this.prisma.$transaction([
        // First: fails with P2025 if the conversation does not exist.
        this.prisma.conversation.update({
          where: { id: conversationId },
          data: { modifiedAt: new Date() },
        }),
        this.prisma.message.create({
          data: {
            ...message,
            usage: toJson(usage),
            source: toJson(source),
            conversation: { connect: { id: conversationId } },
            ...(providerName && {
              provider: {
                connectOrCreate: {
                  where: { providerName },
                  create: { providerName },
                },
              },
            }),
          },
        }),
      ]),
    );
    return created;
  }

  /** Runs `query` and turns Prisma's "record not found" into a 404. */
  private async orNotFound<T>(id: string, query: () => Promise<T>): Promise<T> {
    try {
      return await query();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        throw this.notFound(id);
      }
      throw error;
    }
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Conversation "${id}" not found`);
  }
}
