import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AddressDto } from '@/common/dto/address.dto';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

export class CreateAttorneyDto {
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/julian-vance.jpg',
    description: 'Attorney avatar URL',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ApiProperty({ example: 'Julian Vance' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'j.vance@firm.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: '+1 (480) 420-1600' })
  @Transform(({ value }: { value: string }) => {
    const trimmed = value?.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsOptional()
  @IsPhoneNumber()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: '+1 (480) 420-1695' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fax?: string;

  @ApiPropertyOptional({ example: 'https://firm.example.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/julian-vance' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  linkedin?: string;

  @ApiPropertyOptional({ example: 'NY-882910' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(80)
  barLicenseNumber?: string;

  @ApiPropertyOptional({ example: 'Second Circuit' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(120)
  federalCircuit?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ example: 12, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ type: [String], example: ['English', 'Spanish'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  languageProficiencies?: string[];

  @ApiProperty({
    type: [String],
    example: ['Civil Rights', 'Immigration Law'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  specialties!: string[];

  @ApiPropertyOptional({ type: [String], example: ['Nevada', 'Arizona'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  states?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['District Court, D. Nevada'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  courts?: string[];

  @ApiPropertyOptional({ type: [String], example: ['D. Nevada'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  districts?: string[];

  @ApiPropertyOptional({ example: 'Experienced federal litigation attorney.' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}
export class UpdateAttorneyDto extends PartialType(CreateAttorneyDto) {}

export class ListAttorneysDto extends PaginationBaseDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, phone, bar number, circuit, or state',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by language proficiency (exact match)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;
}
