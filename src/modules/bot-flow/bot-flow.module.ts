import { Module } from '@nestjs/common';
import { BotFlowService } from './bot-flow.service';
import { BotFlowController } from './bot-flow.controller';
import { PrismaModule } from 'src/infra/database/prisma.module';
import {
  BotAdminsController,
  BotSettingsController,
  PublicBotFlowController,
} from './public-bot.controller';

@Module({
    imports: [PrismaModule],
    controllers: [
      BotFlowController,
      BotSettingsController,
      BotAdminsController,
      PublicBotFlowController,
    ],
    providers: [BotFlowService],
    exports: [BotFlowService], // di-export agar bisa dipakai ConversationModule
})
export class BotFlowModule { }
