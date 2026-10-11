import { ApiProperty } from '@nestjs/swagger';
import { LegalType } from '@prisma-client';
import {
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

export class LegalFaqItemDto {
  @ApiProperty({ example: 'How do I request legal assistance?' })
  @IsString()
  @MaxLength(300)
  question!: string;

  @ApiProperty({ example: 'Use SOS or contact support from the app.' })
  @IsString()
  @MaxLength(5000)
  answer!: string;

  @ApiProperty({ minimum: 0, example: 1 })
  @IsInt()
  @Min(0)
  sequence!: number;
}

export type LegalContentValue = string | LegalFaqItemDto[];

@ValidatorConstraint({ name: 'legalContent' })
class LegalContentValidator implements ValidatorConstraintInterface {
  validate(content: unknown, args: ValidationArguments) {
    const type = (args.object as CreateLegalDto).type;
    if (type === LegalType.FAQ) {
      return (
        Array.isArray(content) &&
        content.length > 0 &&
        content.every(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof (item as LegalFaqItemDto).question === 'string' &&
            (item as LegalFaqItemDto).question.trim().length > 0 &&
            (item as LegalFaqItemDto).question.length <= 300 &&
            typeof (item as LegalFaqItemDto).answer === 'string' &&
            (item as LegalFaqItemDto).answer.trim().length > 0 &&
            (item as LegalFaqItemDto).answer.length <= 5000 &&
            Number.isInteger((item as LegalFaqItemDto).sequence) &&
            (item as LegalFaqItemDto).sequence >= 0,
        )
      );
    }

    return typeof content === 'string' && content.trim().length > 0;
  }

  defaultMessage(args: ValidationArguments) {
    const type = (args.object as CreateLegalDto).type;
    return type === LegalType.FAQ
      ? 'content must be a non-empty FAQ array'
      : 'content must be a non-empty markdown string';
  }
}

export class CreateLegalDto {
  @ApiProperty({ enum: LegalType })
  @IsEnum(LegalType)
  type!: LegalType;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: '# Terms\n\nMarkdown content.' },
      {
        type: 'array',
        items: { $ref: '#/components/schemas/LegalFaqItemDto' },
      },
    ],
  })
  @Validate(LegalContentValidator)
  content!: LegalContentValue;
}
