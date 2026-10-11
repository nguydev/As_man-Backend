import { Transform } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';

export class UpdateMaintainerDto {
  @ApiPropertyOptional({ example: 'Operations Manager' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional({
    example: { 'system.user': 1, 'system.organization': 2 },
  })
  @IsOptional()
  @IsObject()
  permissions?: PermissionMap;
}
