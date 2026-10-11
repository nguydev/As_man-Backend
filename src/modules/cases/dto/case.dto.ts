import {
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaseOutcome, CaseStatus } from '@prisma-client';
import { PaginationBaseDto } from '@/common/pagination/pagination.dto';

export class CreateCaseDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() attorneyId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() driverId!: string;

  @ApiPropertyOptional({ example: 'Dhaka District Court' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  court?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  hearingDate?: string;

  @ApiPropertyOptional({ example: 'Initial case overview and notes.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ enum: CaseStatus }) @IsEnum(CaseStatus) status!: CaseStatus;
  @ApiPropertyOptional({ enum: CaseOutcome })
  @IsOptional()
  @IsEnum(CaseOutcome)
  outcome?: CaseOutcome;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateCaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  attorneyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ example: 'Dhaka District Court' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  court?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  hearingDate?: string | null;

  @ApiPropertyOptional({ example: 'Updated case overview.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string | null;
}

export class ListCasesDto extends PaginationBaseDto {
  @ApiPropertyOptional({ enum: CaseStatus })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by attorney' })
  @IsOptional()
  @IsUUID()
  attorneyId?: string;

  @ApiPropertyOptional({ description: 'Search by court or case id' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
