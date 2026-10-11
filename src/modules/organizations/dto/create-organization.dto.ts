import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationStatus } from '@prisma-client';
import { AddressDto } from '@/common/dto/address.dto';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Asman Logistics' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'ops@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: 'South Asia' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({ format: 'uuid', description: 'Initial organization owner' })
  @IsUUID()
  ownerUserId!: string;
}

export class UpdateOrganizationStatusDto {
  @ApiProperty({ enum: OrganizationStatus })
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;

  @ApiPropertyOptional({
    description: 'Required when rejecting or suspending an organization',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateOrganizationDto extends PartialType(
  OmitType(CreateOrganizationDto, ['ownerUserId'] as const),
) {}
