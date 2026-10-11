import { Transform } from 'class-transformer';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateFleetDto {
  @ApiProperty({ example: 'Northeast Day Fleet' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: '#16a34a',
    description: 'Hex indicator color for map markers',
  })
  @Transform(({ value }: { value?: string }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateFleetDto extends PartialType(CreateFleetDto) {}

export class AssignFleetDriverDto {
  @ApiProperty({ format: 'uuid', description: 'Driver id to assign' })
  @IsUUID()
  driverId!: string;
}
