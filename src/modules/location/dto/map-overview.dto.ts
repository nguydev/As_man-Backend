import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MapOverviewCountsDto {
  @ApiProperty({ example: 5 })
  drivers!: number;

  @ApiProperty({ example: 1 })
  organizations!: number;

  @ApiProperty({ example: 1 })
  attorneys!: number;

  @ApiProperty({ example: 1 })
  sos!: number;

  @ApiProperty({ example: 1 })
  hazards!: number;

  @ApiProperty({ example: 9 })
  total!: number;
}

export class MapOverviewLatLngDto {
  @ApiProperty({ example: 40.7128 })
  lat!: number;

  @ApiProperty({ example: -74.006 })
  lng!: number;
}

export class MapOverviewBoundsDto {
  @ApiProperty({ example: 40.73 })
  north!: number;

  @ApiProperty({ example: 40.69 })
  south!: number;

  @ApiProperty({ example: -73.98 })
  east!: number;

  @ApiProperty({ example: -74.03 })
  west!: number;
}

export class MapOverviewResponseDto {
  @ApiProperty({
    description: 'True when the caller has no visible map points to frame',
  })
  empty!: boolean;

  @ApiPropertyOptional({ type: MapOverviewLatLngDto, nullable: true })
  center!: MapOverviewLatLngDto | null;

  @ApiPropertyOptional({ type: MapOverviewBoundsDto, nullable: true })
  bounds!: MapOverviewBoundsDto | null;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'Suggested camera zoom (3–16) for the overview bounds',
  })
  zoom!: number | null;

  @ApiProperty({ type: MapOverviewCountsDto })
  counts!: MapOverviewCountsDto;
}
