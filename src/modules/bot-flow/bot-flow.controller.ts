import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiResponse,
    ApiBody,
} from '@nestjs/swagger';
import { BotFlowService } from './bot-flow.service';
import { CreateBotFlowDto } from './dto/create-bot-flow.dto';
import { CreateBotFlowStepDto } from './dto/create-bot-flow-step.dto';
import { CreateBotMessageDto } from './dto/create-bot-message.dto';
import { JwtAuthGuard } from '../../infra/guards/jwt-auth.guard';
import { Roles } from '../../infra/decorators/roles.decorator';
import { RolesGuard } from '../../infra/guards/roles.guard';

// ─── Shared example data ───────────────────────────────────────────────
const FLOW_EXAMPLE = {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    categoryId: 'f1e2d3c4-0000-0000-0000-000000000099',
    flowName: 'Flow Pengaduan Kebersihan',
    description: 'Alur tanya-jawab untuk pengaduan masalah kebersihan lingkungan',
    isActive: true,
    createdAt: '2026-02-28T14:00:00.000Z',
    updatedAt: '2026-02-28T14:00:00.000Z',
    deletedAt: null,
    category: {
        id: 'f1e2d3c4-0000-0000-0000-000000000099',
        name: 'Kebersihan',
    },
    steps: [
        {
            id: 'step-uuid-0001',
            flowId: 'a1b2c3d4-0000-0000-0000-000000000001',
            stepKey: 'ask_location',
            stepOrder: 1,
            inputType: 'text',
            isRequired: true,
            validationRule: null,
            nextStepKey: 'ask_description',
            messages: [
                {
                    id: 'msg-uuid-9001',
                    messageKey: 'ask_location',
                    messageType: 'question',
                    messageText: 'Di mana lokasi yang ingin Anda laporkan?',
                },
            ],
        },
        {
            id: 'step-uuid-0002',
            flowId: 'a1b2c3d4-0000-0000-0000-000000000001',
            stepKey: 'ask_description',
            stepOrder: 2,
            inputType: 'text',
            isRequired: true,
            validationRule: null,
            nextStepKey: null,
            messages: [],
        },
    ],
};

const STEP_EXAMPLE = {
    id: 'step-uuid-0001',
    flowId: 'a1b2c3d4-0000-0000-0000-000000000001',
    stepKey: 'ask_location',
    stepOrder: 1,
    inputType: 'text',
    isRequired: true,
    validationRule: null,
    nextStepKey: 'ask_description',
    createdAt: '2026-02-28T14:00:00.000Z',
    updatedAt: '2026-02-28T14:00:00.000Z',
    deletedAt: null,
};

const MESSAGE_EXAMPLE = {
    id: 'msg-uuid-9001',
    flowStepId: null,
    messageKey: 'greeting',
    messageType: 'greeting',
    messageText:
        'Halo! 👋 Selamat datang di Layanan Publik Pintar.\n\nSilakan pilih kategori layanan Anda.',
    metadata: null,
    createdAt: '2026-02-28T14:00:00.000Z',
    updatedAt: '2026-02-28T14:00:00.000Z',
    deletedAt: null,
    flowStep: null,
};

const ERROR_401 = { statusCode: 401, message: 'Unauthorized' };
const ERROR_403 = { statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' };
const ERROR_404 = (resource: string) => ({
    statusCode: 404,
    message: `${resource} tidak ditemukan`,
    error: 'Not Found',
});
const ERROR_409 = (key: string) => ({
    statusCode: 409,
    message: `messageKey "${key}" sudah ada. Gunakan endpoint update.`,
    error: 'Conflict',
});

// ─── Controller ────────────────────────────────────────────────────────
@ApiTags('CMS - Bot Flow')
@ApiBearerAuth('jwt-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('cms/bot-flow')
export class BotFlowController {
    constructor(private readonly botFlowService: BotFlowService) { }

    // ═══════════════════════════════════════════════════════════════
    // BOT FLOWS
    // ═══════════════════════════════════════════════════════════════

    @Post('flows')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Buat alur percakapan bot baru',
        description:
            'Membuat flow chatbot baru yang dapat dihubungkan ke kategori layanan tertentu. ' +
            'Jika `categoryId` dikosongkan, flow berfungsi sebagai **global flow**. ' +
            'Setiap flow memiliki steps (langkah-langkah) yang menentukan alur tanya-jawab dengan user.',
    })
    @ApiBody({ type: CreateBotFlowDto })
    @ApiResponse({
        status: 201,
        description: 'Alur percakapan berhasil dibuat.',
        schema: {
            example: {
                id: 'a1b2c3d4-0000-0000-0000-000000000001',
                categoryId: 'f1e2d3c4-0000-0000-0000-000000000099',
                flowName: 'Flow Pengaduan Kebersihan',
                description: 'Alur tanya-jawab untuk pengaduan masalah kebersihan lingkungan',
                isActive: true,
                createdAt: '2026-02-28T14:00:00.000Z',
                updatedAt: '2026-02-28T14:00:00.000Z',
                deletedAt: null,
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak. Hanya admin/superadmin.', schema: { example: ERROR_403 } })
    createFlow(@Body() dto: CreateBotFlowDto) {
        return this.botFlowService.createFlow(dto);
    }

    @Get('flows')
    @ApiOperation({
        summary: 'Daftar semua alur percakapan bot',
        description:
            'Mengambil semua bot flow beserta steps dan messages-nya. ' +
            'Data termasuk informasi kategori yang terhubung (jika ada).',
    })
    @ApiResponse({
        status: 200,
        description: 'Daftar alur percakapan berhasil diambil.',
        schema: {
            example: [FLOW_EXAMPLE],
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    findAllFlows() {
        return this.botFlowService.findAllFlows();
    }

    @Get('flows/:id')
    @ApiOperation({
        summary: 'Detail alur percakapan bot',
        description: 'Mengambil detail satu bot flow berdasarkan ID, termasuk seluruh steps dan messages-nya.',
    })
    @ApiParam({ name: 'id', description: 'UUID bot flow', example: 'a1b2c3d4-0000-0000-0000-000000000001' })
    @ApiResponse({
        status: 200,
        description: 'Detail alur percakapan berhasil diambil.',
        schema: { example: FLOW_EXAMPLE },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Bot flow tidak ditemukan.', schema: { example: ERROR_404('BotFlow dengan id a1b2c3d4-...') } })
    findFlowById(@Param('id') id: string) {
        return this.botFlowService.findFlowById(id);
    }

    @Patch('flows/:id')
    @ApiOperation({
        summary: 'Update alur percakapan bot',
        description:
            'Mengubah data bot flow seperti nama, deskripsi, kategori, atau status aktif. ' +
            'Gunakan `isActive: false` untuk menonaktifkan flow tanpa menghapusnya.',
    })
    @ApiParam({ name: 'id', description: 'UUID bot flow', example: 'a1b2c3d4-0000-0000-0000-000000000001' })
    @ApiBody({ type: CreateBotFlowDto })
    @ApiResponse({
        status: 200,
        description: 'Alur percakapan berhasil diperbarui.',
        schema: {
            example: {
                ...FLOW_EXAMPLE,
                flowName: 'Flow Pengaduan Kebersihan (Updated)',
                isActive: false,
                updatedAt: '2026-03-01T08:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Bot flow tidak ditemukan.', schema: { example: ERROR_404('BotFlow dengan id a1b2c3d4-...') } })
    updateFlow(@Param('id') id: string, @Body() dto: Partial<CreateBotFlowDto>) {
        return this.botFlowService.updateFlow(id, dto);
    }

    @Delete('flows/:id')
    @ApiOperation({
        summary: 'Hapus alur percakapan bot (soft delete)',
        description:
            'Menghapus bot flow secara **soft delete** (mengisi `deletedAt`). ' +
            'Data tidak benar-benar terhapus dari database sehingga masih bisa dipulihkan.',
    })
    @ApiParam({ name: 'id', description: 'UUID bot flow', example: 'a1b2c3d4-0000-0000-0000-000000000001' })
    @ApiResponse({
        status: 200,
        description: 'Alur percakapan berhasil dihapus (soft delete).',
        schema: {
            example: {
                ...FLOW_EXAMPLE,
                deletedAt: '2026-03-01T08:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Bot flow tidak ditemukan.', schema: { example: ERROR_404('BotFlow dengan id a1b2c3d4-...') } })
    deleteFlow(@Param('id') id: string) {
        return this.botFlowService.deleteFlow(id);
    }

    // ═══════════════════════════════════════════════════════════════
    // BOT FLOW STEPS
    // ═══════════════════════════════════════════════════════════════

    @Post('steps')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Tambah langkah baru ke dalam flow',
        description:
            'Menambahkan sebuah step (langkah tanya-jawab) ke dalam bot flow. ' +
            'Gunakan `stepOrder` untuk mengatur urutan, dan `nextStepKey` untuk menentukan step berikutnya. ' +
            'Jika `nextStepKey` kosong, step ini adalah **akhir dari flow**. ' +
            '`inputType` yang tersedia: `text`, `number`, `select`, `confirmation`, `info`.',
    })
    @ApiBody({ type: CreateBotFlowStepDto })
    @ApiResponse({
        status: 201,
        description: 'Langkah percakapan berhasil dibuat.',
        schema: { example: STEP_EXAMPLE },
    })
    @ApiResponse({
        status: 409,
        description: 'stepKey sudah ada di flow yang sama.',
        schema: {
            example: {
                statusCode: 409,
                message: 'stepKey "ask_location" sudah ada di flow ini',
                error: 'Conflict',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    createStep(@Body() dto: CreateBotFlowStepDto) {
        return this.botFlowService.createStep(dto);
    }

    @Patch('steps/:id')
    @ApiOperation({
        summary: 'Update langkah percakapan',
        description:
            'Mengubah konfigurasi sebuah step, seperti urutan, tipe input, validasi, atau step berikutnya.',
    })
    @ApiParam({ name: 'id', description: 'UUID bot flow step', example: 'step-uuid-0001' })
    @ApiBody({ type: CreateBotFlowStepDto })
    @ApiResponse({
        status: 200,
        description: 'Langkah percakapan berhasil diperbarui.',
        schema: {
            example: {
                ...STEP_EXAMPLE,
                validationRule: 'min:10',
                updatedAt: '2026-03-01T08:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Step tidak ditemukan.', schema: { example: ERROR_404('BotFlowStep step-uuid-0001') } })
    updateStep(@Param('id') id: string, @Body() dto: Partial<CreateBotFlowStepDto>) {
        return this.botFlowService.updateStep(id, dto);
    }

    @Delete('steps/:id')
    @ApiOperation({
        summary: 'Hapus langkah percakapan (soft delete)',
        description: 'Menghapus step secara soft delete. Step yang dihapus tidak akan dieksekusi dalam alur percakapan.',
    })
    @ApiParam({ name: 'id', description: 'UUID bot flow step', example: 'step-uuid-0001' })
    @ApiResponse({
        status: 200,
        description: 'Langkah percakapan berhasil dihapus.',
        schema: {
            example: {
                ...STEP_EXAMPLE,
                deletedAt: '2026-03-01T08:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Step tidak ditemukan.', schema: { example: ERROR_404('BotFlowStep step-uuid-0001') } })
    deleteStep(@Param('id') id: string) {
        return this.botFlowService.deleteStep(id);
    }

    // ═══════════════════════════════════════════════════════════════
    // BOT MESSAGES
    // ═══════════════════════════════════════════════════════════════

    @Post('messages')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Buat pesan bot baru',
        description:
            'Membuat pesan bot baru yang dapat dikustomisasi via CMS. ' +
            '`messageKey` harus **unik** dan digunakan sebagai identifier dari kode (contoh: `greeting`, `timeout`, `success`). ' +
            'Jika `flowStepId` kosong, pesan adalah **pesan global** (tidak terikat step manapun). ' +
            '\n\n**Tipe pesan yang tersedia:** `greeting`, `timeout`, `success`, `error`, `question`, `confirmation`, `info`, `invalid_input`, `session_expired`.',
    })
    @ApiBody({ type: CreateBotMessageDto })
    @ApiResponse({
        status: 201,
        description: 'Pesan bot berhasil dibuat.',
        schema: { example: MESSAGE_EXAMPLE },
    })
    @ApiResponse({
        status: 409,
        description: 'messageKey sudah digunakan.',
        schema: { example: ERROR_409('greeting') },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    createMessage(@Body() dto: CreateBotMessageDto) {
        return this.botFlowService.createMessage(dto);
    }

    @Get('messages')
    @ApiOperation({
        summary: 'Daftar semua pesan bot',
        description:
            'Mengambil seluruh pesan bot yang bisa dikustomisasi melalui CMS, ' +
            'diurutkan berdasarkan `messageKey`. Setiap pesan menyertakan informasi step yang terhubung (jika ada).',
    })
    @ApiResponse({
        status: 200,
        description: 'Daftar pesan bot berhasil diambil.',
        schema: {
            example: [
                MESSAGE_EXAMPLE,
                {
                    id: 'msg-uuid-9002',
                    flowStepId: null,
                    messageKey: 'success',
                    messageType: 'success',
                    messageText:
                        '🎉 Laporan Anda berhasil diterima! Tim kami akan segera menindaklanjuti.',
                    metadata: null,
                    createdAt: '2026-02-28T14:00:00.000Z',
                    updatedAt: '2026-02-28T14:00:00.000Z',
                    deletedAt: null,
                    flowStep: null,
                },
                {
                    id: 'msg-uuid-9003',
                    flowStepId: null,
                    messageKey: 'timeout',
                    messageType: 'timeout',
                    messageText:
                        '⏰ Sesi Anda telah berakhir. Kirim pesan kembali untuk sesi baru.',
                    metadata: null,
                    createdAt: '2026-02-28T14:00:00.000Z',
                    updatedAt: '2026-02-28T14:00:00.000Z',
                    deletedAt: null,
                    flowStep: null,
                },
                {
                    id: 'msg-uuid-9004',
                    flowStepId: 'step-uuid-0001',
                    messageKey: 'ask_location',
                    messageType: 'question',
                    messageText: 'Di mana lokasi yang ingin Anda laporkan?',
                    metadata: null,
                    createdAt: '2026-02-28T14:00:00.000Z',
                    updatedAt: '2026-02-28T14:00:00.000Z',
                    deletedAt: null,
                    flowStep: {
                        id: 'step-uuid-0001',
                        stepKey: 'ask_location',
                        flowId: 'a1b2c3d4-0000-0000-0000-000000000001',
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    findAllMessages() {
        return this.botFlowService.findAllMessages();
    }

    @Get('messages/:key')
    @ApiOperation({
        summary: 'Cari pesan bot berdasarkan messageKey',
        description:
            'Mengambil satu pesan bot berdasarkan `messageKey`. ' +
            'Berguna untuk preview pesan sebelum mengedit via CMS.',
    })
    @ApiParam({
        name: 'key',
        description: 'Key unik pesan bot',
        example: 'greeting',
    })
    @ApiResponse({
        status: 200,
        description: 'Pesan bot ditemukan.',
        schema: { example: MESSAGE_EXAMPLE },
    })
    @ApiResponse({
        status: 404,
        description: 'Pesan bot tidak ditemukan.',
        schema: { example: ERROR_404('BotMessage key "greeting"') },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    findMessageByKey(@Param('key') key: string) {
        return this.botFlowService.findMessageByKey(key);
    }

    @Patch('messages/:id')
    @ApiOperation({
        summary: '✏️ Update teks pesan bot (utama untuk CMS)',
        description:
            'Endpoint utama untuk admin mengubah teks pesan chatbot melalui CMS. ' +
            'Cukup kirimkan field `messageText` yang baru untuk mengubah pesan yang ditampilkan ke user. ' +
            '\n\n**Catatan:** Field `{name}` dan `{ticketNumber}` adalah placeholder dinamis ' +
            'yang akan digantikan otomatis oleh sistem saat pesan dikirim.',
    })
    @ApiParam({ name: 'id', description: 'UUID pesan bot', example: 'msg-uuid-9001' })
    @ApiBody({
        schema: {
            example: {
                messageText:
                    'Halo! 👋 Selamat datang di Layanan Publik Kota Bandung.\n\nAda yang bisa kami bantu hari ini?',
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Teks pesan bot berhasil diperbarui.',
        schema: {
            example: {
                ...MESSAGE_EXAMPLE,
                messageText:
                    'Halo! 👋 Selamat datang di Layanan Publik Kota Bandung.\n\nAda yang bisa kami bantu hari ini?',
                updatedAt: '2026-03-01T08:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Pesan bot tidak ditemukan.', schema: { example: ERROR_404('BotMessage msg-uuid-9001') } })
    updateMessage(@Param('id') id: string, @Body() dto: Partial<CreateBotMessageDto>) {
        return this.botFlowService.updateMessage(id, dto);
    }

    @Delete('messages/:id')
    @ApiOperation({
        summary: 'Hapus pesan bot (soft delete)',
        description:
            'Menghapus pesan bot secara soft delete. ' +
            'Jika pesan yang dihapus adalah pesan global (seperti `greeting`), ' +
            'sistem akan menggunakan **teks fallback bawaan** dari kode.',
    })
    @ApiParam({ name: 'id', description: 'UUID pesan bot', example: 'msg-uuid-9001' })
    @ApiResponse({
        status: 200,
        description: 'Pesan bot berhasil dihapus.',
        schema: {
            example: {
                ...MESSAGE_EXAMPLE,
                deletedAt: '2026-03-01T08:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token tidak valid atau expired.', schema: { example: ERROR_401 } })
    @ApiResponse({ status: 403, description: 'Akses ditolak.', schema: { example: ERROR_403 } })
    @ApiResponse({ status: 404, description: 'Pesan bot tidak ditemukan.', schema: { example: ERROR_404('BotMessage msg-uuid-9001') } })
    deleteMessage(@Param('id') id: string) {
        return this.botFlowService.deleteMessage(id);
    }
}
