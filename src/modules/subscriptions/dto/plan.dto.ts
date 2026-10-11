import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Fleet 25' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ minimum: 50, description: 'Monthly price in cents' })
  @IsInt()
  @Min(50)
  price!: number;

  @ApiProperty({ example: 'usd' })
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  driverLimit!: number;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
