import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsObject,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';

export class CreateMaintainerDto {
  @ApiProperty({ example: 'Jane Admin' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'maintainer@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: 'Operations Manager' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  jobTitle!: string;

  @ApiProperty({
    example: { 'system.user': 1, 'system.organization': 2 },
  })
  @IsObject()
  permissions!: PermissionMap;
}
