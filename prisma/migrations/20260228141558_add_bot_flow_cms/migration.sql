-- DropForeignKey
ALTER TABLE "bot_flow_steps" DROP CONSTRAINT "bot_flow_steps_flow_id_fkey";

-- AddForeignKey
ALTER TABLE "bot_flow_steps" ADD CONSTRAINT "bot_flow_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "bot_messages_key_unique" RENAME TO "bot_messages_message_key_key";
