import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsPhoneNumber,
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IncidentAlertStatus, IncidentAlertType } from '@prisma-client';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

export class ListSosIncidentsDto extends PaginationBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ enum: IncidentAlertStatus })
  @IsOptional()
  @IsEnum(IncidentAlertStatus)
  status?: IncidentAlertStatus;

  @ApiPropertyOptional({ enum: IncidentAlertType })
  @IsOptional()
  @IsEnum(IncidentAlertType)
  type?: IncidentAlertType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class CreateIncidentCaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  attorneyId!: string;

  @ApiPropertyOptional({ example: 'Dhaka District Court' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  court?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  hearingDate?: string;

  @ApiPropertyOptional({ example: 'Case created from SOS incident.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

export class CreateEmergencyContactDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/contact.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: '+8801712345678',
    description: 'Phone number with country calling code',
  })
  @IsPhoneNumber()
  phone!: string;

  @ApiPropertyOptional({ example: 'Spouse' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  relation?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) priority?: number;
}
export class UpdateEmergencyContactDto extends PartialType(
  CreateEmergencyContactDto,
) {}
export class TriggerSosDto {
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lon?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
