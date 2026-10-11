import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MapLocationsQueryDto {
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

  @ApiProperty({ minimum: 1, maximum: 22 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(22)
  zoom!: number;
}
