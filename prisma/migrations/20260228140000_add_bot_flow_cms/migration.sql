-- Migration: Add Bot Flow CMS tables
-- Tanggal: 2026-02-28
-- Deskripsi: Menambahkan tabel bot_flows, bot_flow_steps, dan bot_messages
--            untuk sistem pesan chatbot yang bisa dikonfigurasi via CMS.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. bot_flows
--    Alur percakapan per kategori layanan. categoryId null = flow global.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "bot_flows" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "category_id" UUID,
  "flow_name"   VARCHAR     NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN     NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3),
  "deleted_at"  TIMESTAMP(3),

  CONSTRAINT "bot_flows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bot_flows_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "bot_flows_category_id_idx" ON "bot_flows"("category_id");
CREATE INDEX "bot_flows_is_active_idx"   ON "bot_flows"("is_active");

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bot_flow_steps
--    Langkah-langkah dalam sebuah bot_flow.
--    step_key unik di dalam flow, dan digunakan sebagai referensi (next_step_key).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "bot_flow_steps" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "flow_id"         UUID        NOT NULL,
  "step_key"        VARCHAR     NOT NULL,
  "step_order"      INTEGER     NOT NULL,
  "input_type"      VARCHAR     NOT NULL,     -- text | number | select | confirmation | info
  "is_required"     BOOLEAN     NOT NULL DEFAULT true,
  "validation_rule" VARCHAR,                  -- contoh: regex:/^[0-9]{16}$/
  "next_step_key"   VARCHAR,                  -- null = akhir flow
  "created_at"      TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3),
  "deleted_at"      TIMESTAMP(3),

  CONSTRAINT "bot_flow_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bot_flow_steps_flow_id_fkey"
    FOREIGN KEY ("flow_id") REFERENCES "bot_flows"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "bot_flow_steps_flow_id_idx"   ON "bot_flow_steps"("flow_id");
CREATE INDEX "bot_flow_steps_step_key_idx"  ON "bot_flow_steps"("step_key");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. bot_messages
--    Pesan-pesan chatbot, baik global maupun terikat ke step.
--    message_key adalah identifier unik untuk lookup dari kode (e.g. 'greeting').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "bot_messages" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "flow_step_id" UUID,                        -- null = pesan global
  "message_key"  VARCHAR     NOT NULL,        -- unik, contoh: greeting, timeout, success
  "message_type" VARCHAR     NOT NULL,        -- greeting | timeout | success | error | question | confirmation | info
  "message_text" TEXT        NOT NULL,
  "metadata"     JSONB,                       -- e.g. { "buttons": ["Ya","Tidak"] }
  "created_at"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3),
  "deleted_at"   TIMESTAMP(3),

  CONSTRAINT "bot_messages_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "bot_messages_key_unique" UNIQUE ("message_key"),
  CONSTRAINT "bot_messages_flow_step_id_fkey"
    FOREIGN KEY ("flow_step_id") REFERENCES "bot_flow_steps"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "bot_messages_flow_step_id_idx" ON "bot_messages"("flow_step_id");
CREATE INDEX "bot_messages_message_key_idx"  ON "bot_messages"("message_key");
