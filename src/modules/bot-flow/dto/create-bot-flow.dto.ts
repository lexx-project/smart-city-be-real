import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateBotFlowDto {
    @ApiPropertyOptional({
        description: 'ID kategori yang menggunakan flow ini. Kosong/null = flow global',
        example: 'uuid-kategori',
    })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiProperty({
        description: 'Nama alur percakapan',
        example: 'Flow Pengaduan Kebersihan',
    })
    @IsString()
    flowName: string;

    @ApiPropertyOptional({
        description: 'Deskripsi singkat tentang flow ini',
        example: 'Alur tanya-jawab untuk pengaduan masalah kebersihan lingkungan',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Status aktif flow', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
