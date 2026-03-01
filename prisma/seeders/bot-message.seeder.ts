import { PrismaClient } from '../../generated/prisma/client';

/**
 * Seeder untuk pesan-pesan bot default yang dapat dikustomisasi via CMS.
 *
 * Setiap pesan diidentifikasi dengan `messageKey` yang unik.
 * Admin bisa mengubah `messageText` kapan saja melalui endpoint CMS.
 */

interface BotMessageSeed {
    messageKey: string;
    messageType: string;
    messageText: string;
    metadata?: Record<string, any>;
}

const defaultMessages: BotMessageSeed[] = [
    // ─────────────────────────────────────────
    // GLOBAL MESSAGES (tidak terikat flow step)
    // ─────────────────────────────────────────
    {
        messageKey: 'greeting',
        messageType: 'greeting',
        messageText:
            'Halo! 👋 Selamat datang di *Layanan Publik Pintar*.\n\nSaya adalah asisten virtual yang siap membantu Anda menyampaikan pengaduan, pertanyaan, atau permintaan layanan kepada instansi terkait.\n\nMari kita mulai!',
    },
    {
        messageKey: 'timeout',
        messageType: 'timeout',
        messageText:
            '⏰ Sesi Anda telah berakhir karena tidak ada aktivitas selama 1 jam.\n\nJika Anda ingin melanjutkan, silakan kirim pesan kembali dan kami akan membantu Anda dari awal.',
    },
    {
        messageKey: 'session_expired',
        messageType: 'session_expired',
        messageText:
            '⚠️ Mohon maaf, sesi Anda telah kedaluwarsa.\n\nSilakan kirim pesan kembali untuk memulai sesi baru.',
    },
    {
        messageKey: 'error',
        messageType: 'error',
        messageText:
            '❌ Maaf, terjadi kesalahan pada sistem kami.\n\nSilakan coba beberapa saat lagi atau hubungi kami melalui saluran lain.',
    },
    {
        messageKey: 'invalid_choice',
        messageType: 'error',
        messageText:
            '⚠️ Pilihan tidak valid. Silakan balas dengan *angka* sesuai menu yang tersedia.',
    },
    {
        messageKey: 'no_categories',
        messageType: 'info',
        messageText:
            '😔 Mohon maaf, saat ini belum ada layanan yang tersedia.\n\nSilakan coba kembali lain waktu atau hubungi kantor kami langsung.',
    },

    // ─────────────────────────────────────────
    // CATEGORY SELECTION MESSAGES
    // ─────────────────────────────────────────
    {
        messageKey: 'category_prompt',
        messageType: 'question',
        messageText:
            '📋 Silakan pilih *kategori* keluhan atau permintaan layanan Anda:\n(Balas dengan angka sesuai pilihan)',
    },
    {
        messageKey: 'sub_category_prompt',
        messageType: 'question',
        messageText:
            '📋 Silakan pilih *sub-kategori* lebih lanjut:\n(Balas dengan angka sesuai pilihan)',
    },
    {
        messageKey: 'category_selected',
        messageType: 'info',
        messageText: 'Anda memilih: *{name}*',
    },

    // ─────────────────────────────────────────
    // DESCRIPTION / TICKET CREATION
    // ─────────────────────────────────────────
    {
        messageKey: 'description_prompt',
        messageType: 'question',
        messageText:
            '✅ Kategori dipilih: *{name}*\n\n📝 Silakan jelaskan keluhan atau permintaan Anda secara *detail* agar kami dapat membantu dengan lebih baik.\n\n(Contoh: lokasi kejadian, waktu, nama petugas yang terlibat, dll.)',
    },
    {
        messageKey: 'success',
        messageType: 'success',
        messageText:
            '🎉 *Laporan Anda berhasil diterima!*\n\nTim kami akan segera menindaklanjuti dan menghubungi Anda kembali dalam waktu yang telah ditentukan.\n\nTerima kasih telah menggunakan Layanan Publik Pintar. 🙏',
    },

    // ─────────────────────────────────────────
    // ADDITIONAL OPTIONAL MESSAGES
    // ─────────────────────────────────────────
    {
        messageKey: 'ticket_status_update',
        messageType: 'info',
        messageText:
            '🔔 Tiket Anda *#{ticketNumber}* telah diperbarui.\nStatus: *{status}*\n\nKetik CARI untuk melihat detail tiket Anda.',
    },
    {
        messageKey: 'confirmation_prompt',
        messageType: 'confirmation',
        messageText:
            '❓ Apakah informasi berikut sudah benar?\n\n{summary}\n\nBalas *1* untuk *Ya, Kirim* atau *2* untuk *Ulangi*.',
        metadata: { options: ['1. Ya, Kirim', '2. Ulangi'] },
    },
];

export async function seedBotMessages(prisma: PrismaClient) {
    console.log(`  → Seeding ${defaultMessages.length} bot messages...`);

    let created = 0;
    let skipped = 0;

    for (const msg of defaultMessages) {
        const existing = await (prisma as any).botMessage.findFirst({
            where: { messageKey: msg.messageKey },
        });

        if (existing) {
            console.log(`    ⏭  Skipped (already exists): ${msg.messageKey}`);
            skipped++;
            continue;
        }

        await (prisma as any).botMessage.create({
            data: {
                messageKey: msg.messageKey,
                messageType: msg.messageType,
                messageText: msg.messageText,
                metadata: msg.metadata ?? null,
            },
        });

        console.log(`    ✅ Created: ${msg.messageKey}`);
        created++;
    }

    console.log(`  ✔ Bot Messages: ${created} created, ${skipped} skipped.`);
}
