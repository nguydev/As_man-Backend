import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

class DriverIdentityDto {
  @ApiProperty({ example: 'Driver Name' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'driver@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: '1HGBH41JXMN109186' })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  vinNumber!: string;

  @ApiProperty({ example: 'ABC-1234' })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  licensePlate!: string;
}

export class AdminCreateDriverDto extends DriverIdentityDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fleetId?: string;
}

export class ProviderCreateDriverDto extends DriverIdentityDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fleetId?: string;
}

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'Driver Name' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '1HGBH41JXMN109186' })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vinNumber?: string;

  @ApiPropertyOptional({ example: 'ABC-1234' })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  @IsOptional()
  @IsString()
  @MaxLength(32)
  licensePlate?: string;
}

export class ListDriversDto extends PaginationBaseDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, phone, VIN, or license plate',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
