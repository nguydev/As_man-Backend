import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  EmailDispatchRecipientType,
  EmailDispatchStatus,
} from '@prisma-client';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

export class CreateTemplateDto {
  @ApiProperty({ example: 'SOS acknowledgment email' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    description: 'Markdown body rendered by clients',
    example: '## Hello\n\nYour SOS was **received**.',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  content!: string;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class ListTemplatesDto extends PaginationBaseDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive title search',
    example: 'SOS',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class SendTemplateEmailDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ enum: EmailDispatchRecipientType })
  @IsEnum(EmailDispatchRecipientType)
  recipientType!: EmailDispatchRecipientType;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((dto: SendTemplateEmailDto) => dto.recipientType === 'USER')
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (dto: SendTemplateEmailDto) => dto.recipientType === 'ORGANIZATION',
  )
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Overrides the template title as the email subject',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Edited markdown body; defaults to the template content',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  content?: string;
}

export class ListEmailDispatchesDto extends PaginationBaseDto {
  @ApiPropertyOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: EmailDispatchStatus })
  @IsOptional()
  @IsEnum(EmailDispatchStatus)
  status?: EmailDispatchStatus;

  @ApiPropertyOptional({ enum: EmailDispatchRecipientType })
  @IsOptional()
  @IsEnum(EmailDispatchRecipientType)
  recipientType?: EmailDispatchRecipientType;
}
