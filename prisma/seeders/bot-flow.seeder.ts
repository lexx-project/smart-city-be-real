import { PrismaClient } from '../../generated/prisma/client';

/**
 * Seeder Bot Flow & Bot Flow Steps
 *
 * Menyimulasikan 3 skenario percakapan chatbot WA yang nyata:
 *
 * 1. 🚧 Jalan Rusak (Infrastruktur)
 *    → User lapor jalan berlubang: lokasi → deskripsi → foto? → selesai
 *
 * 2. 😤 Pelayanan Lambat (Layanan Publik)
 *    → User komplain pelayanan lambat: nama instansi → jenis layanan → kronologi → selesai
 *
 * 3. 📄 Konsultasi KTP Hilang (Kependudukan)
 *    → User tanya cara urus KTP hilang: NIK → konfirmasi kehilangan → arahan → selesai
 */

interface FlowStepSeed {
    stepKey: string;
    stepOrder: number;
    inputType: 'text' | 'number' | 'select' | 'confirmation' | 'info';
    isRequired: boolean;
    validationRule?: string;
    nextStepKey?: string;
    // Pesan yang terkait dengan step ini (akan dibuat di bot_messages sekaligus)
    questionText: string;
    questionKey: string; // messageKey untuk pesan ini
}

interface FlowSeed {
    categoryName: string;       // Nama kategori untuk dicari di DB
    subCategoryName?: string;   // (opsional) nama sub-kategori
    flowName: string;
    description: string;
    steps: FlowStepSeed[];
}

// ──────────────────────────────────────────────────────────────────────────────
// DEFINISI FLOW
// ──────────────────────────────────────────────────────────────────────────────
const flowSeeds: FlowSeed[] = [

    // ═══════════════════════════════════════════════════════════════
    // FLOW 1: Laporan Jalan Rusak
    // Kategori: Infrastruktur > Jalan Rusak
    // ═══════════════════════════════════════════════════════════════
    {
        categoryName: 'Jalan Rusak',
        flowName: 'Laporan Jalan Rusak',
        description:
            'Alur percakapan untuk melaporkan kerusakan jalan: berlubang, bergelombang, atau amblas. '
            + 'Bot akan mengumpulkan lokasi, deskripsi kerusakan, dan tingkat keparahan.',
        steps: [
            {
                stepKey: 'ask_jalan_lokasi',
                stepOrder: 1,
                inputType: 'text',
                isRequired: true,
                validationRule: 'min:10',
                nextStepKey: 'ask_jalan_severity',
                questionKey: 'flow_jalan_ask_lokasi',
                questionText:
                    '📍 *Langkah 1/3 — Lokasi Kejadian*\n\n'
                    + 'Di mana lokasi jalan yang rusak?\n\n'
                    + 'Mohon sebutkan *nama jalan, kelurahan, dan kecamatan* agar tim kami bisa menemukan lokasi dengan tepat.\n\n'
                    + '_Contoh: Jl. Merdeka No.12, Kel. Sukasari, Kec. Cicendo_',
            },
            {
                stepKey: 'ask_jalan_severity',
                stepOrder: 2,
                inputType: 'select',
                isRequired: true,
                nextStepKey: 'ask_jalan_deskripsi',
                questionKey: 'flow_jalan_ask_severity',
                questionText:
                    '⚠️ *Langkah 2/3 — Tingkat Kerusakan*\n\n'
                    + 'Seberapa parah kerusakan jalan tersebut?\n\n'
                    + '1. Ringan — Retak atau sedikit berlubang, masih bisa dilalui\n'
                    + '2. Sedang — Berlubang cukup dalam, bisa membahayakan pengendara\n'
                    + '3. Parah — Amblas, sangat berbahaya, perlu perbaikan segera\n\n'
                    + '_Balas dengan angka 1, 2, atau 3_',
            },
            {
                stepKey: 'ask_jalan_deskripsi',
                stepOrder: 3,
                inputType: 'text',
                isRequired: true,
                validationRule: 'min:20',
                nextStepKey: undefined,
                questionKey: 'flow_jalan_ask_deskripsi',
                questionText:
                    '📝 *Langkah 3/3 — Deskripsi Kerusakan*\n\n'
                    + 'Ceritakan lebih detail tentang kerusakan yang Anda temukan.\n\n'
                    + 'Sertakan informasi seperti:\n'
                    + '• Sudah berapa lama rusak?\n'
                    + '• Apakah sudah pernah dilaporkan sebelumnya?\n'
                    + '• Apakah ada korban akibat kerusakan ini?\n\n'
                    + '_Setelah mengirim deskripsi, laporan Anda akan langsung diproses._',
            },
        ],
    },

    // ═══════════════════════════════════════════════════════════════
    // FLOW 2: Pengaduan Pelayanan Lambat
    // Kategori: Layanan Publik > Pelayanan Lambat
    // ═══════════════════════════════════════════════════════════════
    {
        categoryName: 'Pelayanan Lambat',
        flowName: 'Pengaduan Pelayanan Lambat',
        description:
            'Alur percakapan untuk pengaduan pelayanan instansi yang lambat, tidak responsif, '
            + 'atau tidak sesuai standar. Bot mengumpulkan nama instansi, jenis layanan, dan kronologi.',
        steps: [
            {
                stepKey: 'ask_layanan_instansi',
                stepOrder: 1,
                inputType: 'text',
                isRequired: true,
                validationRule: 'min:5',
                nextStepKey: 'ask_layanan_jenis',
                questionKey: 'flow_layanan_ask_instansi',
                questionText:
                    '🏛️ *Langkah 1/4 — Nama Instansi*\n\n'
                    + 'Di instansi mana Anda mengalami masalah pelayanan?\n\n'
                    + '_Contoh: Dinas Kependudukan dan Pencatatan Sipil (Dukcapil) Kota Bandung_',
            },
            {
                stepKey: 'ask_layanan_jenis',
                stepOrder: 2,
                inputType: 'text',
                isRequired: true,
                validationRule: 'min:5',
                nextStepKey: 'ask_layanan_tanggal',
                questionKey: 'flow_layanan_ask_jenis',
                questionText:
                    '📋 *Langkah 2/4 — Jenis Layanan*\n\n'
                    + 'Layanan apa yang Anda urus saat itu?\n\n'
                    + '_Contoh: Pembuatan KTP, Pengurusan Akta Kelahiran, Mutasi Kartu Keluarga_',
            },
            {
                stepKey: 'ask_layanan_tanggal',
                stepOrder: 3,
                inputType: 'text',
                isRequired: true,
                nextStepKey: 'ask_layanan_kronologi',
                questionKey: 'flow_layanan_ask_tanggal',
                questionText:
                    '📅 *Langkah 3/4 — Tanggal Kejadian*\n\n'
                    + 'Kapan Anda mengurus layanan tersebut?\n\n'
                    + '_Contoh: Senin, 24 Februari 2026, sekitar pukul 09.00 WIB_',
            },
            {
                stepKey: 'ask_layanan_kronologi',
                stepOrder: 4,
                inputType: 'text',
                isRequired: true,
                validationRule: 'min:30',
                nextStepKey: undefined,
                questionKey: 'flow_layanan_ask_kronologi',
                questionText:
                    '📝 *Langkah 4/4 — Kronologi Kejadian*\n\n'
                    + 'Ceritakan secara detail apa yang terjadi.\n\n'
                    + 'Sertakan informasi:\n'
                    + '• Berapa lama Anda menunggu?\n'
                    + '• Apa alasan yang diberikan petugas?\n'
                    + '• Apakah ada petugas yang bisa Anda identifikasi?\n\n'
                    + '_Laporan Anda akan segera diteruskan ke instansi terkait._',
            },
        ],
    },

    // ═══════════════════════════════════════════════════════════════
    // FLOW 3: Konsultasi KTP Hilang
    // Kategori: Kependudukan
    // ═══════════════════════════════════════════════════════════════
    {
        categoryName: 'Kependudukan',
        flowName: 'Konsultasi KTP Hilang',
        description:
            'Alur percakapan untuk membantu warga yang kehilangan KTP. '
            + 'Bot akan mengumpulkan NIK, mengkonfirmasi data, lalu memberikan panduan prosedur penggantian KTP.',
        steps: [
            {
                stepKey: 'ask_ktp_nik',
                stepOrder: 1,
                inputType: 'number',
                isRequired: true,
                validationRule: 'regex:/^[0-9]{16}$/',
                nextStepKey: 'ask_ktp_nama',
                questionKey: 'flow_ktp_ask_nik',
                questionText:
                    '🪪 *Langkah 1/4 — NIK (Nomor Induk Kependudukan)*\n\n'
                    + 'Silakan masukkan *16 digit NIK* Anda yang tertera pada KTP lama atau Kartu Keluarga.\n\n'
                    + '⚠️ _Data Anda dijaga kerahasiaannya dan hanya digunakan untuk keperluan verifikasi._',
            },
            {
                stepKey: 'ask_ktp_nama',
                stepOrder: 2,
                inputType: 'text',
                isRequired: true,
                validationRule: 'min:3',
                nextStepKey: 'ask_ktp_kondisi',
                questionKey: 'flow_ktp_ask_nama',
                questionText:
                    '👤 *Langkah 2/4 — Nama Lengkap*\n\n'
                    + 'Masukkan nama lengkap Anda sesuai KTP.\n\n'
                    + '_Contoh: BUDI SANTOSO_',
            },
            {
                stepKey: 'ask_ktp_kondisi',
                stepOrder: 3,
                inputType: 'select',
                isRequired: true,
                nextStepKey: 'ask_ktp_konfirmasi',
                questionKey: 'flow_ktp_ask_kondisi',
                questionText:
                    '❓ *Langkah 3/4 — Kondisi Kehilangan*\n\n'
                    + 'Apa yang terjadi dengan KTP Anda?\n\n'
                    + '1. Hilang (tidak diketahui di mana)\n'
                    + '2. Dicuri\n'
                    + '3. Rusak / Tidak terbaca\n'
                    + '4. Terbakar atau bencana alam\n\n'
                    + '_Balas dengan angka 1, 2, 3, atau 4_',
            },
            {
                stepKey: 'ask_ktp_konfirmasi',
                stepOrder: 4,
                inputType: 'confirmation',
                isRequired: true,
                nextStepKey: undefined,
                questionKey: 'flow_ktp_ask_konfirmasi',
                questionText:
                    '✅ *Langkah 4/4 — Konfirmasi & Panduan*\n\n'
                    + 'Terima kasih! Berdasarkan informasi Anda, berikut panduan pengurusan KTP:\n\n'
                    + '*Dokumen yang perlu disiapkan:*\n'
                    + '1. Surat keterangan kehilangan dari Kepolisian (jika hilang/dicuri)\n'
                    + '2. Fotokopi Kartu Keluarga\n'
                    + '3. Pas foto 3x4 (2 lembar)\n\n'
                    + '*Langkah selanjutnya:*\n'
                    + '→ Datang ke kantor Dukcapil atau bisa melalui layanan online di *dukcapil.bandung.go.id*\n\n'
                    + 'Apakah ada pertanyaan lain atau ingin membuat laporan resmi?\n\n'
                    + '1. Ya, buat laporan resmi\n'
                    + '2. Tidak, terima kasih\n\n'
                    + '_Balas 1 atau 2_',
            },
        ],
    },
];

// ──────────────────────────────────────────────────────────────────────────────
// FUNGSI SEEDER UTAMA
// ──────────────────────────────────────────────────────────────────────────────
export async function seedBotFlows(prisma: PrismaClient) {
    console.log('  → Seeding bot flows & steps...');

    let flowsCreated = 0;
    let flowsSkipped = 0;
    let stepsCreated = 0;
    let messagesCreated = 0;

    for (const flowDef of flowSeeds) {
        // ── 1. Cari kategori di DB berdasarkan nama ─────────────────────────
        const category = await prisma.category.findFirst({
            where: { name: flowDef.categoryName, isActive: true },
        });

        if (!category) {
            console.log(`    ⚠️  Kategori "${flowDef.categoryName}" tidak ditemukan, skip flow "${flowDef.flowName}"`);
            continue;
        }

        // ── 2. Cek apakah flow sudah ada ───────────────────────────────────
        const existingFlow = await (prisma as any).botFlow.findFirst({
            where: {
                flowName: flowDef.flowName,
                deletedAt: null,
            },
        });

        if (existingFlow) {
            console.log(`    ⏭  Flow "${flowDef.flowName}" already exists, skipped`);
            flowsSkipped++;
            continue;
        }

        // ── 3. Buat flow ────────────────────────────────────────────────────
        const flow = await (prisma as any).botFlow.create({
            data: {
                categoryId: category.id,
                flowName: flowDef.flowName,
                description: flowDef.description,
                isActive: true,
            },
        });

        console.log(`    ✅ Flow created: "${flowDef.flowName}" → Kategori: ${flowDef.categoryName}`);
        flowsCreated++;

        // ── 4. Buat setiap step + pesan step ───────────────────────────────
        for (const stepDef of flowDef.steps) {
            // Buat step
            const step = await (prisma as any).botFlowStep.create({
                data: {
                    flowId: flow.id,
                    stepKey: stepDef.stepKey,
                    stepOrder: stepDef.stepOrder,
                    inputType: stepDef.inputType,
                    isRequired: stepDef.isRequired,
                    validationRule: stepDef.validationRule ?? null,
                    nextStepKey: stepDef.nextStepKey ?? null,
                },
            });

            stepsCreated++;
            console.log(`       ✓ Step [${stepDef.stepOrder}] "${stepDef.stepKey}" created`);

            // Buat pesan untuk step ini (jika belum ada)
            const existingMsg = await (prisma as any).botMessage.findFirst({
                where: { messageKey: stepDef.questionKey },
            });

            if (!existingMsg) {
                await (prisma as any).botMessage.create({
                    data: {
                        flowStepId: step.id,
                        messageKey: stepDef.questionKey,
                        messageType: 'question',
                        messageText: stepDef.questionText,
                        metadata: null,
                    },
                });
                messagesCreated++;
                console.log(`          💬 Message "${stepDef.questionKey}" created`);
            } else {
                console.log(`          ⏭  Message "${stepDef.questionKey}" already exists, skipped`);
            }
        }

        console.log('');
    }

    console.log(
        `  ✔ Bot Flows: ${flowsCreated} created, ${flowsSkipped} skipped.\n`
        + `  ✔ Flow Steps: ${stepsCreated} created.\n`
        + `  ✔ Step Messages: ${messagesCreated} created.`,
    );
}
