import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportHazardDto {
  @ApiProperty({ example: 40.7128 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -74.006 })
  @Type(() => Number)
  @IsLongitude()
  lon!: number;
}

export class ListHazardsQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  north!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  south!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  east!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  west!: number;
}
