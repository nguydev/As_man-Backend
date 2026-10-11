import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

class AccountSignupDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 120 })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 320 })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class OrganizationSignupDto extends AccountSignupDto {
  @ApiProperty({ example: 'Asman Logistics', maxLength: 160 })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  organizationName!: string;
}

export class DriverSignupDto extends AccountSignupDto {
  @ApiProperty({ example: '1HGBH41JXMN109186', maxLength: 64 })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  vinNumber!: string;

  @ApiProperty({ example: 'ABC-1234', maxLength: 32 })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  licensePlate!: string;
}
