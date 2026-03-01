import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsUUID,
    IsBoolean,
    IsInt,
    IsIn,
    Min,
} from 'class-validator';

export type InputType = 'text' | 'number' | 'select' | 'confirmation' | 'info';
export const INPUT_TYPES: InputType[] = ['text', 'number', 'select', 'confirmation', 'info'];

export class CreateBotFlowStepDto {
    @ApiProperty({ description: 'ID dari bot flow' })
    @IsUUID()
    flowId: string;

    @ApiProperty({
        description: 'Key unik langkah dalam flow, contoh: ask_name, ask_nik, ask_description',
        example: 'ask_nik',
    })
    @IsString()
    stepKey: string;

    @ApiProperty({ description: 'Urutan langkah dalam flow', example: 1 })
    @IsInt()
    @Min(1)
    stepOrder: number;

    @ApiProperty({
        description: 'Tipe input yang diharapkan dari user',
        enum: INPUT_TYPES,
        example: 'text',
    })
    @IsIn(INPUT_TYPES)
    inputType: InputType;

    @ApiPropertyOptional({ description: 'Apakah langkah ini wajib diisi?', default: true })
    @IsOptional()
    @IsBoolean()
    isRequired?: boolean;

    @ApiPropertyOptional({
        description: 'Aturan validasi, contoh: regex:/^[0-9]{16}$/ atau min:10',
        example: 'regex:/^[0-9]{16}$/',
    })
    @IsOptional()
    @IsString()
    validationRule?: string;

    @ApiPropertyOptional({
        description: 'Key step berikutnya, null = akhir flow',
        example: 'ask_description',
    })
    @IsOptional()
    @IsString()
    nextStepKey?: string;
}
