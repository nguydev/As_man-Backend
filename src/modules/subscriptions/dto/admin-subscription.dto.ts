import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SubStatus } from '@prisma-client';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

export class ListAdminSubscriptionsDto extends PaginationBaseDto {
  @ApiPropertyOptional({ enum: SubStatus })
  @IsOptional()
  @IsEnum(SubStatus)
  status?: SubStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({
    description: 'Search by Stripe subscription ID, organization, or plan name',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
