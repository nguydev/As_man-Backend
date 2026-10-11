import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum AdminVaultTargetType {
  ORGANIZATION = 'ORGANIZATION',
  DRIVER = 'DRIVER',
  CASE = 'CASE',
}

export class CreateVaultDocumentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() fileObjectId!: string;

  @ApiPropertyOptional({
    example: 'EAD · EAC-23-901-23456',
    description: 'Display label for the vault document',
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  caseId?: string;
}

export class LinkVaultCaseDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() caseId!: string;
}

export class CreateAdminVaultDocumentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fileObjectId!: string;

  @ApiProperty({ enum: AdminVaultTargetType })
  @IsEnum(AdminVaultTargetType)
  targetType!: AdminVaultTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;
}
