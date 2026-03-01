import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';

import { TicketModule } from '../ticket/ticket.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { BotFlowModule } from '../bot-flow/bot-flow.module';

@Module({
  imports: [TicketModule, PrismaModule, BotFlowModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule { }
