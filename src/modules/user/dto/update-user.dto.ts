import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Role, UserStatus } from '@prisma-client';
import { AddressDto } from '@/common/dto/address.dto';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'Alex Morgan' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'alex@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @Transform(({ value }: { value: string }) => {
    const trimmed = value?.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsOptional()
  @IsPhoneNumber()
  @MaxLength(32)
  phone?: string;
}

export class ListUsersDto extends PaginationBaseDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search by name, email, or phone' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class SearchUsersDto {
  @ApiPropertyOptional({ description: 'Search by name or email' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({
    description: 'When true, only users that have a Driver profile are returned',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  driversOnly?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;

  @ApiPropertyOptional({
    description: 'Required when banning, restricting, or suspending a user',
    maxLength: 500,
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @ValidateIf((dto: UpdateUserStatusDto) => dto.status !== UserStatus.ACTIVE)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ example: 'Alex Morgan', nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @ApiPropertyOptional({ example: '+15551234567', nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsPhoneNumber()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/alex.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
