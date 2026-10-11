import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';
import {
  DeliveryChannelDto,
  NotificationAudienceDto,
} from '@/modules/notifications/types/notification.types';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationAudienceDto })
  @IsEnum(NotificationAudienceDto)
  audience!: NotificationAudienceDto;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (dto: CreateNotificationDto) =>
      dto.audience === NotificationAudienceDto.USER,
  )
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (dto: CreateNotificationDto) =>
      dto.audience === NotificationAudienceDto.ORGANIZATION,
  )
  @IsUUID()
  organizationId?: string;

  @ApiProperty()
  @Transform(({ value }: { value?: string }) => value?.trim())
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @Transform(({ value }: { value?: string }) => value?.trim())
  @IsString()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ enum: DeliveryChannelDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(DeliveryChannelDto, { each: true })
  channels?: DeliveryChannelDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class ListNotificationsQueryDto extends PaginationBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value?: string | boolean }) =>
    value === true || value === 'true' ? true : undefined,
  )
  unreadOnly?: boolean;
}

export class CreateOrganizationNotificationDto {
  @ApiProperty()
  @Transform(({ value }: { value?: string }) => value?.trim())
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @Transform(({ value }: { value?: string }) => value?.trim())
  @IsString()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ enum: DeliveryChannelDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(DeliveryChannelDto, { each: true })
  channels?: DeliveryChannelDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
