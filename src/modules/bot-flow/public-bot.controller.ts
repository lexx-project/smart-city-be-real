import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/infra/decorators/public.decorator';
import { BotFlowService } from './bot-flow.service';

@ApiTags('Bot Settings')
@Public()
@Controller('bot-settings')
export class BotSettingsController {
  @Get()
  @ApiOperation({
    summary: 'Konfigurasi chatbot publik',
    description: 'Mengambil pengaturan bot untuk kanal publik (WhatsApp).',
  })
  @ApiResponse({
    status: 200,
    description: 'Pengaturan bot berhasil diambil.',
    schema: {
      example: {
        GREETING_MSG: 'Halo! Selamat datang di layanan Smart City.',
        SESSION_END_TEXT: 'Terima kasih.',
      },
    },
  })
  getSettings() {
    return {
      GREETING_MSG: 'Halo! Selamat datang di layanan Smart City.',
      SESSION_END_TEXT: 'Terima kasih.',
    };
  }
}

@ApiTags('Bot Admins')
@Public()
@Controller('bot-admins')
export class BotAdminsController {
  constructor(private readonly botFlowService: BotFlowService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar admin bot (public)',
    description: 'Mengambil nomor WhatsApp admin aktif untuk notifikasi bot.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar nomor admin berhasil diambil.',
    schema: { example: ['628123456789'] },
  })
  async getAdmins() {
    const phones = await this.botFlowService.getBotAdminPhones();
    return phones.length > 0 ? phones : ['628123456789'];
  }
}

@ApiTags('Bot Flow (Public)')
@Public()
@Controller('bot-flow')
export class PublicBotFlowController {
  constructor(private readonly botFlowService: BotFlowService) {}

  @Get('menu')
  @ApiOperation({
    summary: 'Ambil menu/root flow bot',
    description:
      'Mengambil node flow pertama (root) beserta children-nya untuk kebutuhan chatbot publik.',
  })
  @ApiResponse({
    status: 200,
    description: 'Menu flow berhasil diambil.',
  })
  getMenu() {
    return this.botFlowService.getPublicMenu();
  }

  @Get('step/:id')
  @ApiOperation({
    summary: 'Ambil detail satu step flow',
    description: 'Mengambil step berdasarkan ID lengkap beserta messages dan children.',
  })
  @ApiResponse({
    status: 200,
    description: 'Step flow berhasil diambil.',
  })
  @ApiResponse({
    status: 404,
    description: 'Step tidak ditemukan.',
  })
  getStep(@Param('id') id: string) {
    return this.botFlowService.getPublicStepById(id);
  }
}
