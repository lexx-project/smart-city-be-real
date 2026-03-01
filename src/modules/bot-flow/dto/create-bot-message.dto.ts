import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsUUID,
    IsObject,
    IsIn,
} from 'class-validator';

export type MessageType =
    | 'greeting'
    | 'timeout'
    | 'success'
    | 'error'
    | 'question'
    | 'confirmation'
    | 'info'
    | 'invalid_input'
    | 'session_expired';

export const MESSAGE_TYPES: MessageType[] = [
    'greeting',
    'timeout',
    'success',
    'error',
    'question',
    'confirmation',
    'info',
    'invalid_input',
    'session_expired',
];

export class CreateBotMessageDto {
    @ApiPropertyOptional({ description: 'ID dari flow step (opsional, null = pesan global)' })
    @IsOptional()
    @IsUUID()
    flowStepId?: string;

    @ApiProperty({
        description: 'Key unik untuk lookup pesan, contoh: greeting, success, timeout',
        example: 'greeting',
    })
    @IsString()
    messageKey: string;

    @ApiProperty({
        description: 'Tipe pesan',
        enum: MESSAGE_TYPES,
        example: 'greeting',
    })
    @IsIn(MESSAGE_TYPES)
    messageType: MessageType;

    @ApiProperty({
        description: 'Teks pesan yang ditampilkan ke user',
        example: 'Halo! Selamat datang di Layanan Publik Pintar. Ada yang bisa saya bantu?',
    })
    @IsString()
    messageText: string;

    @ApiPropertyOptional({
        description: 'Metadata tambahan, misalnya tombol pilihan atau URL gambar',
        example: { buttons: ['Ya', 'Tidak'] },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
