import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CreateBotFlowDto } from './dto/create-bot-flow.dto';
import { CreateBotFlowStepDto } from './dto/create-bot-flow-step.dto';
import { CreateBotMessageDto } from './dto/create-bot-message.dto';

@Injectable()
export class BotFlowService {
    private readonly logger = new Logger(BotFlowService.name);

    constructor(private readonly prisma: PrismaService) { }

    // ─────────────────────────────────────────────
    // BOT MESSAGE LOOKUP (dipakai oleh ConversationService)
    // ─────────────────────────────────────────────

    /**
     * Ambil teks pesan berdasarkan messageKey (e.g. 'greeting', 'timeout', 'success').
     * Jika tidak ditemukan di DB, fallback ke teks default.
     */
    async getMessage(messageKey: string, fallback?: string): Promise<string> {
        const msg = await this.prisma.botMessage.findFirst({
            where: { messageKey, deletedAt: null },
        });

        if (msg) return msg.messageText;

        this.logger.warn(
            `BotMessage key "${messageKey}" tidak ditemukan di DB, menggunakan fallback.`,
        );
        return fallback ?? `[Pesan "${messageKey}" belum dikonfigurasi]`;
    }

    /**
     * Ambil BotFlowStep berdasarkan categoryId + stepKey
     */
    async getFlowStep(categoryId: string, stepKey: string) {
        const flow = await this.prisma.botFlow.findFirst({
            where: { categoryId, isActive: true, deletedAt: null },
            include: {
                steps: {
                    where: { stepKey, deletedAt: null },
                    include: { messages: { where: { deletedAt: null } } },
                },
            },
        });

        return flow?.steps?.[0] ?? null;
    }

    /**
     * Ambil seluruh steps dari flow by categoryId, urut berdasarkan stepOrder
     */
    async getFlowSteps(categoryId: string) {
        const flow = await this.prisma.botFlow.findFirst({
            where: { categoryId, isActive: true, deletedAt: null },
            include: {
                steps: {
                    where: { deletedAt: null },
                    orderBy: { stepOrder: 'asc' },
                    include: { messages: { where: { deletedAt: null } } },
                },
            },
        });

        return flow?.steps ?? [];
    }

    // ─────────────────────────────────────────────
    // PUBLIC BOT FLOW (untuk webhook chatbot)
    // ─────────────────────────────────────────────

    async getPublicMenu() {
        const flow = await this.prisma.botFlow.findFirst({
            where: { isActive: true, deletedAt: null },
            include: {
                steps: {
                    where: { deletedAt: null },
                    orderBy: { stepOrder: 'asc' },
                    include: {
                        messages: {
                            where: { deletedAt: null },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        if (!flow || flow.steps.length === 0) {
            throw new NotFoundException('Bot flow menu tidak ditemukan');
        }

        // Schema saat ini belum punya kolom isRoot, jadi root diambil dari stepOrder paling awal.
        const rootStep = flow.steps.find((step) => step.stepOrder === 1) ?? flow.steps[0];
        return this.buildStepTree(rootStep, flow.steps);
    }

    async getPublicStepById(id: string) {
        const step = await this.prisma.botFlowStep.findFirst({
            where: { id, deletedAt: null, flow: { isActive: true, deletedAt: null } },
            include: {
                messages: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!step) throw new NotFoundException(`Bot flow step ${id} tidak ditemukan`);

        const allSteps = await this.prisma.botFlowStep.findMany({
            where: { flowId: step.flowId, deletedAt: null },
            orderBy: { stepOrder: 'asc' },
            include: {
                messages: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        return this.buildStepTree(step, allSteps);
    }

    async getBotAdminPhones() {
        const admins = await this.prisma.staffUser.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                phone: { not: null },
                role: {
                    deletedAt: null,
                    name: { contains: 'admin', mode: 'insensitive' },
                },
            },
            select: { phone: true },
            orderBy: { createdAt: 'asc' },
        });

        return admins
            .map((admin) => this.toWhatsappMsisdn(admin.phone))
            .filter((phone): phone is string => !!phone);
    }

    private buildStepTree(step: any, allSteps: any[], visited = new Set<string>()) {
        if (visited.has(step.id)) {
            return { ...step, children: [] };
        }

        const nextVisited = new Set(visited);
        nextVisited.add(step.id);

        const children = step.nextStepKey
            ? allSteps
                .filter((candidate) => candidate.stepKey === step.nextStepKey)
                .map((child) => this.buildStepTree(child, allSteps, nextVisited))
            : [];

        return {
            ...step,
            children,
        };
    }

    private toWhatsappMsisdn(phone: string | null): string | null {
        if (!phone) return null;
        const digits = phone.replace(/\D/g, '');
        if (!digits) return null;
        if (digits.startsWith('62')) return digits;
        if (digits.startsWith('0')) return `62${digits.slice(1)}`;
        return digits;
    }

    // ─────────────────────────────────────────────
    // CMS: BOT FLOWS CRUD
    // ─────────────────────────────────────────────

    async createFlow(dto: CreateBotFlowDto) {
        return this.prisma.botFlow.create({ data: dto });
    }

    async findAllFlows() {
        return this.prisma.botFlow.findMany({
            where: { deletedAt: null },
            include: {
                category: { select: { id: true, name: true } },
                steps: {
                    where: { deletedAt: null },
                    orderBy: { stepOrder: 'asc' },
                    include: { messages: { where: { deletedAt: null } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findFlowById(id: string) {
        const flow = await this.prisma.botFlow.findFirst({
            where: { id, deletedAt: null },
            include: {
                category: { select: { id: true, name: true } },
                steps: {
                    where: { deletedAt: null },
                    orderBy: { stepOrder: 'asc' },
                    include: { messages: { where: { deletedAt: null } } },
                },
            },
        });
        if (!flow) throw new NotFoundException(`BotFlow dengan id ${id} tidak ditemukan`);
        return flow;
    }

    async updateFlow(id: string, dto: Partial<CreateBotFlowDto>) {
        await this.findFlowById(id);
        return this.prisma.botFlow.update({ where: { id }, data: dto });
    }

    async deleteFlow(id: string) {
        await this.findFlowById(id);
        return this.prisma.botFlow.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    // ─────────────────────────────────────────────
    // CMS: BOT FLOW STEPS CRUD
    // ─────────────────────────────────────────────

    async createStep(dto: CreateBotFlowStepDto) {
        // Pastikan stepKey unik di dalam flow yang sama
        const existing = await this.prisma.botFlowStep.findFirst({
            where: { flowId: dto.flowId, stepKey: dto.stepKey, deletedAt: null },
        });
        if (existing) {
            throw new ConflictException(
                `stepKey "${dto.stepKey}" sudah ada di flow ini`,
            );
        }
        return this.prisma.botFlowStep.create({ data: dto });
    }

    async updateStep(id: string, dto: Partial<CreateBotFlowStepDto>) {
        const step = await this.prisma.botFlowStep.findFirst({
            where: { id, deletedAt: null },
        });
        if (!step) throw new NotFoundException(`BotFlowStep ${id} tidak ditemukan`);
        return this.prisma.botFlowStep.update({ where: { id }, data: dto });
    }

    async deleteStep(id: string) {
        const step = await this.prisma.botFlowStep.findFirst({
            where: { id, deletedAt: null },
        });
        if (!step) throw new NotFoundException(`BotFlowStep ${id} tidak ditemukan`);
        return this.prisma.botFlowStep.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    // ─────────────────────────────────────────────
    // CMS: BOT MESSAGES CRUD
    // ─────────────────────────────────────────────

    async createMessage(dto: CreateBotMessageDto) {
        const existing = await this.prisma.botMessage.findFirst({
            where: { messageKey: dto.messageKey, deletedAt: null },
        });
        if (existing) {
            throw new ConflictException(
                `messageKey "${dto.messageKey}" sudah ada. Gunakan endpoint update.`,
            );
        }
        return this.prisma.botMessage.create({ data: dto });
    }

    async findAllMessages() {
        return this.prisma.botMessage.findMany({
            where: { deletedAt: null },
            include: {
                flowStep: {
                    select: { id: true, stepKey: true, flowId: true },
                },
            },
            orderBy: { messageKey: 'asc' },
        });
    }

    async findMessageByKey(messageKey: string) {
        const msg = await this.prisma.botMessage.findFirst({
            where: { messageKey, deletedAt: null },
        });
        if (!msg)
            throw new NotFoundException(`BotMessage key "${messageKey}" tidak ditemukan`);
        return msg;
    }

    async updateMessage(id: string, dto: Partial<CreateBotMessageDto>) {
        const msg = await this.prisma.botMessage.findFirst({
            where: { id, deletedAt: null },
        });
        if (!msg) throw new NotFoundException(`BotMessage ${id} tidak ditemukan`);
        return this.prisma.botMessage.update({ where: { id }, data: dto });
    }

    async deleteMessage(id: string) {
        const msg = await this.prisma.botMessage.findFirst({
            where: { id, deletedAt: null },
        });
        if (!msg) throw new NotFoundException(`BotMessage ${id} tidak ditemukan`);
        return this.prisma.botMessage.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}
