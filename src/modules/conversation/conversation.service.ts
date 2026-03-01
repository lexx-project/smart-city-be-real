import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/infra/redis/redis.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TicketService } from '../ticket/ticket.service';
import { MessageType, SenderType } from '../../../generated/prisma/enums';
import { WhatsappService } from 'src/infra/whatsapp/whatsapp.service';
import { BotFlowService } from '../bot-flow/bot-flow.service';

export enum ConversationState {
  IDLE = 'IDLE',
  COLLECTING_CATEGORY = 'COLLECTING_CATEGORY',
  COLLECTING_DESCRIPTION = 'COLLECTING_DESCRIPTION',
  IN_FLOW = 'IN_FLOW',
}

// ─────────────────────────────────────────────────────────
// Kunci pesan yang bisa dikustomisasi via CMS
// Admin tinggal update messageText di tabel bot_messages
// ─────────────────────────────────────────────────────────
export const BOT_MSG_KEYS = {
  GREETING: 'greeting',
  CATEGORY_PROMPT: 'category_prompt',
  SUB_CATEGORY_PROMPT: 'sub_category_prompt',
  CATEGORY_SELECTED: 'category_selected',
  DESCRIPTION_PROMPT: 'description_prompt',
  SUCCESS: 'success',
  TIMEOUT: 'timeout',
  SESSION_EXPIRED: 'session_expired',
  INVALID_CHOICE: 'invalid_choice',
  INVALID_INPUT: 'invalid_input',
  NO_CATEGORIES: 'no_categories',
  ERROR: 'error',
} as const;

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly ticketService: TicketService,
    private readonly whatsappService: WhatsappService,
    private readonly botFlowService: BotFlowService,
  ) { }

  verifyWebhook(mode: string, token: string, challenge: string) {
    const verifyToken = this.configService.get<string>('WA_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }
    return 'Verification failed';
  }

  async processIncoming(payload: any) {
    this.logger.log('Received WhatsApp payload');

    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return { status: 'ignored' };
    }

    const phoneNumber = message.from;
    const text = message.text?.body?.trim();

    if (!text) {
      return { status: 'ignored' };
    }

    // 1. Get or Create User
    let user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phoneNumber,
          isVerified: false,
        },
      });
    }

    // 2. Get active session or create new one
    let session = await this.prisma.session.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!session) {
      const channel =
        (await this.prisma.channel.findFirst({
          where: { provider: 'whatsapp' },
        })) ??
        (await this.prisma.channel.create({
          data: { name: 'WhatsApp', provider: 'whatsapp' },
        }));

      session = await this.prisma.session.create({
        data: {
          userId: user.id,
          channelId: channel.id,
          state: ConversationState.IDLE,
          isActive: true,
          startedAt: new Date(),
        },
      });
    }

    // 3. Log incoming message
    await this.logMessage(session.id, SenderType.USER, text);

    // 4. Update session last activity
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    // 5. Handle transitions
    await this.handleStateTransition(user, session, text);

    return { status: 'processed' };
  }

  private async handleStateTransition(
    user: any,
    session: any,
    text: string,
  ) {
    const currentState = session.state as ConversationState;

    switch (currentState) {
      case ConversationState.IDLE: {
        // Ambil pesan greeting dari DB (bisa diubah admin via CMS)
        const greeting = await this.botFlowService.getMessage(
          BOT_MSG_KEYS.GREETING,
          'Halo! Selamat datang di Layanan Publik Pintar. Dengan apa saya bisa membantu Anda hari ini?',
        );
        await this.sendMessage(session.id, user.phoneNumber, greeting);
        await this.showCategoryMenu(session.id, user.phoneNumber);
        break;
      }

      case ConversationState.COLLECTING_CATEGORY: {
        const currentParentId = await this.redis.get(
          `session_data:${session.id}:parent_category`,
        );
        const categories = await this.prisma.category.findMany({
          where: {
            isActive: true,
            parentId: currentParentId ?? null,
          },
          orderBy: { sortOrder: 'asc' },
        });

        const choice = parseInt(text);

        if (isNaN(choice) || choice < 1 || choice > categories.length) {
          const invalidMsg = await this.botFlowService.getMessage(
            BOT_MSG_KEYS.INVALID_CHOICE,
            'Pilihan tidak valid. Silakan balas dengan angka yang sesuai.',
          );
          await this.sendMessage(session.id, user.phoneNumber, invalidMsg);
          return;
        }

        const selectedCategory = categories[choice - 1];

        const children = await this.prisma.category.findMany({
          where: { parentId: selectedCategory.id, isActive: true },
        });

        if (children.length > 0) {
          // Branch: pergi ke sub-kategori
          await this.redis.set(
            `session_data:${session.id}:parent_category`,
            selectedCategory.id,
            'EX',
            3600,
          );
          const selectedMsg = await this.botFlowService.getMessage(
            BOT_MSG_KEYS.CATEGORY_SELECTED,
            `Anda memilih: *{name}*`,
          );
          await this.sendMessage(
            session.id,
            user.phoneNumber,
            selectedMsg.replace('{name}', selectedCategory.name),
          );
          await this.showCategoryMenu(
            session.id,
            user.phoneNumber,
            selectedCategory.id,
          );
        } else {
          // Leaf: Cek apakah ada BotFlow khusus untuk kategori ini
          await this.redis.set(
            `session_data:${session.id}:category`,
            selectedCategory.id,
            'EX',
            3600,
          );

          const flowSteps = await this.botFlowService.getFlowSteps(selectedCategory.id);

          if (flowSteps.length > 0) {
            // Start custom flow
            const firstStep = flowSteps[0];
            await this.redis.set(`session_data:${session.id}:current_step_key`, firstStep.stepKey, 'EX', 3600);
            await this.redis.del(`session_data:${session.id}:flow_data`); // Reset data flow sebelumnya jika ada

            const questionText = firstStep.messages[0]?.messageText || `Mohon isi data untuk ${firstStep.stepKey}`;
            await this.sendMessage(session.id, user.phoneNumber, questionText);
            await this.updateSessionState(session.id, ConversationState.IN_FLOW);
          } else {
            // Fallback: Default description prompt
            const descPrompt = await this.botFlowService.getMessage(
              BOT_MSG_KEYS.DESCRIPTION_PROMPT,
              `Anda memilih kategori: *{name}*\n\nSilakan jelaskan keluhan Anda secara detail.`,
            );
            await this.sendMessage(
              session.id,
              user.phoneNumber,
              descPrompt.replace('{name}', selectedCategory.name),
            );
            await this.updateSessionState(
              session.id,
              ConversationState.COLLECTING_DESCRIPTION,
            );
          }
        }
        break;
      }

      case ConversationState.COLLECTING_DESCRIPTION: {
        const catId = await this.redis.get(
          `session_data:${session.id}:category`,
        );

        try {
          await this.ticketService.create({
            description: text,
            userId: user.id,
            categoryId: catId || '',
          });

          const successMsg = await this.botFlowService.getMessage(
            BOT_MSG_KEYS.SUCCESS,
            'Terima kasih! Laporan Anda telah berhasil kami terima dan akan segera diproses. Kami akan menghubungi Anda kembali.',
          );
          await this.sendMessage(session.id, user.phoneNumber, successMsg);
        } catch (error) {
          this.logger.error('Gagal membuat tiket', error);
          const errorMsg = await this.botFlowService.getMessage(
            BOT_MSG_KEYS.ERROR,
            'Maaf, terjadi kesalahan pada sistem. Silakan coba lagi nanti.',
          );
          await this.sendMessage(session.id, user.phoneNumber, errorMsg);
        } finally {
          await this.prisma.session.update({
            where: { id: session.id },
            data: { isActive: false, state: 'COMPLETED' },
          });
        }
        break;
      }

      case ConversationState.IN_FLOW: {
        await this.handleFlowStep(user, session, text);
        break;
      }
    }
  }

  private async handleFlowStep(user: any, session: any, text: string) {
    const currentStepKey = await this.redis.get(`session_data:${session.id}:current_step_key`);
    const catId = await this.redis.get(`session_data:${session.id}:category`);

    if (!currentStepKey || !catId) {
      await this.sendMessage(session.id, user.phoneNumber, 'Terjadi kesalahan sesi. Silakan mulai ulang.');
      await this.updateSessionState(session.id, ConversationState.IDLE);
      return;
    }

    const steps = await this.botFlowService.getFlowSteps(catId);
    const currentStep = steps.find(s => s.stepKey === currentStepKey);

    if (!currentStep) {
      await this.sendMessage(session.id, user.phoneNumber, 'Langkah tidak ditemukan. Silakan mulai ulang.');
      await this.updateSessionState(session.id, ConversationState.IDLE);
      return;
    }

    // 1. Validasi Input (Simple Validation)
    if (currentStep.validationRule) {
      const isValid = this.validateInput(text, currentStep.validationRule);
      if (!isValid) {
        const invalidMsg = await this.botFlowService.getMessage(
          BOT_MSG_KEYS.INVALID_INPUT,
          'Input tidak sesuai format. Silakan periksa kembali.',
        );
        await this.sendMessage(session.id, user.phoneNumber, invalidMsg);
        return;
      }
    }

    // 2. Simpan Data
    const rawData = await this.redis.get(`session_data:${session.id}:flow_data`);
    const flowData = rawData ? JSON.parse(rawData) : {};
    flowData[currentStepKey] = text;
    await this.redis.set(`session_data:${session.id}:flow_data`, JSON.stringify(flowData), 'EX', 3600);

    // 3. Move to next step or complete
    if (currentStep.nextStepKey) {
      const nextStep = steps.find(s => s.stepKey === currentStep.nextStepKey);
      if (nextStep) {
        await this.redis.set(`session_data:${session.id}:current_step_key`, nextStep.stepKey, 'EX', 3600);
        const nextQuestion = nextStep.messages[0]?.messageText || `Mohon isi ${nextStep.stepKey}`;
        await this.sendMessage(session.id, user.phoneNumber, nextQuestion);
        return;
      }
    }

    // COMPLETE FLOW
    try {
      // Format description from all steps
      let finalDescription = '';
      for (const step of steps) {
        const value = flowData[step.stepKey] || '-';
        // Ambil label dari message key atau format key
        const label = step.stepKey.replace(/_/g, ' ').toUpperCase();
        finalDescription += `*${label}*: ${value}\n`;
      }

      await this.ticketService.create({
        description: finalDescription,
        userId: user.id,
        categoryId: catId,
      });

      const successMsg = await this.botFlowService.getMessage(
        BOT_MSG_KEYS.SUCCESS,
        'Terima kasih! Laporan Anda telah berhasil kami terima.',
      );
      await this.sendMessage(session.id, user.phoneNumber, successMsg);
    } catch (error) {
      this.logger.error('Gagal membuat tiket via flow', error);
      await this.sendMessage(session.id, user.phoneNumber, 'Gagal menyimpan laporan. Silakan coba lagi.');
    } finally {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isActive: false, state: 'COMPLETED' },
      });
      await this.redis.del(`session_data:${session.id}:flow_data`);
      await this.redis.del(`session_data:${session.id}:current_step_key`);
    }
  }

  private validateInput(text: string, rule: string): boolean {
    if (rule.startsWith('regex:')) {
      const pattern = rule.replace('regex:', '');
      // Handle potential slashes in regex string
      const firstSlash = pattern.indexOf('/');
      const lastSlash = pattern.lastIndexOf('/');
      if (firstSlash !== -1 && lastSlash !== -1 && lastSlash > firstSlash) {
        const regexStr = pattern.substring(firstSlash + 1, lastSlash);
        const flags = pattern.substring(lastSlash + 1);
        try {
          const regex = new RegExp(regexStr, flags);
          return regex.test(text);
        } catch (e) {
          this.logger.error(`Invalid regex rule: ${rule}`, e);
          return true;
        }
      }
    }
    if (rule.startsWith('min:')) {
      const minLength = parseInt(rule.replace('min:', ''));
      return text.length >= minLength;
    }
    return true;
  }

  private async showCategoryMenu(
    sessionId: string,
    phoneNumber: string,
    parentId: string | null = null,
  ) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, parentId: parentId ?? null },
      orderBy: { sortOrder: 'asc' },
    });

    if (categories.length === 0) {
      const noCatMsg = await this.botFlowService.getMessage(
        BOT_MSG_KEYS.NO_CATEGORIES,
        'Mohon maaf, saat ini belum ada layanan yang tersedia. Silakan coba lagi nanti.',
      );
      await this.sendMessage(sessionId, phoneNumber, noCatMsg);
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false, state: 'NO_CATEGORIES' },
      });
      return;
    }

    const promptKey = parentId
      ? BOT_MSG_KEYS.SUB_CATEGORY_PROMPT
      : BOT_MSG_KEYS.CATEGORY_PROMPT;

    const title = await this.botFlowService.getMessage(
      promptKey,
      parentId
        ? 'Silakan pilih sub-kategori (balas dengan angka):'
        : 'Silakan pilih kategori keluhan Anda (balas dengan angka):',
    );

    let menu = `${title}\n`;
    categories.forEach((cat, index) => {
      menu += `\n${index + 1}. ${cat.name}`;
      if (cat.description) menu += ` — ${cat.description}`;
    });

    await this.sendMessage(sessionId, phoneNumber, menu);
    await this.updateSessionState(sessionId, ConversationState.COLLECTING_CATEGORY);
  }

  private async updateSessionState(
    sessionId: string,
    state: ConversationState,
  ) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { state },
    });
  }

  private async logMessage(
    sessionId: string,
    sender: SenderType,
    content: string,
  ) {
    await this.prisma.message.create({
      data: {
        sessionId,
        sender,
        messageType: MessageType.TEXT,
        content,
      },
    });
  }

  private async sendMessage(sessionId: string, to: string, text: string) {
    await this.logMessage(sessionId, SenderType.BOT, text);
    await this.whatsappService.sendTextMessage(to, text);
  }

  // ─────────────────────────────────────────────
  // Cron Job: Bersihkan sesi yang expired
  // ─────────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    const timeout = new Date(Date.now() - 3600 * 1000); // 1 jam
    const sessions = await this.prisma.session.findMany({
      where: {
        isActive: true,
        lastActivityAt: { lt: timeout },
      },
      include: { user: true },
    });

    // Kirim pesan timeout ke setiap sesi yang expired
    for (const session of sessions) {
      try {
        const timeoutMsg = await this.botFlowService.getMessage(
          BOT_MSG_KEYS.TIMEOUT,
          'Sesi Anda telah berakhir karena tidak ada aktivitas. Jika ingin melanjutkan, silakan kirim pesan kembali.',
        );
        await this.sendMessage(
          session.id,
          session.user.phoneNumber,
          timeoutMsg,
        );
      } catch (err) {
        this.logger.warn(
          `Gagal kirim pesan timeout ke session ${session.id}: ${err.message}`,
        );
      }
    }

    const result = await this.prisma.session.updateMany({
      where: {
        isActive: true,
        lastActivityAt: { lt: timeout },
      },
      data: { isActive: false, state: 'TIMEOUT' },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
  }
}
