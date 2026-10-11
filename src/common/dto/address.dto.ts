import { Transform } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiPropertyOptional({ example: '123 Main Street' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Dhaka Division' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ example: '1205' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @ApiPropertyOptional({ example: '23.8103' })
  @IsOptional()
  @IsLatitude()
  latitude?: string;

  @ApiPropertyOptional({ example: '90.4125' })
  @IsOptional()
  @IsLongitude()
  longitude?: string;
}
