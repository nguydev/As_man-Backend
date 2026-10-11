import type { PrismaClient } from '../generated/prisma/client';
import { LegalType } from '../generated/prisma/enums';

const legalPages = [
  {
    type: LegalType.TERMS_AND_CONDITIONS,
    content: '# Terms and Conditions\n\nSeed terms content.',
  },
  {
    type: LegalType.PRIVACY_POLICY,
    content: '# Privacy Policy\n\nSeed privacy policy content.',
  },
  {
    type: LegalType.COOKIES_POLICY,
    content: '# Cookies Policy\n\nSeed cookies policy content.',
  },
  {
    type: LegalType.LEGAL_NOTICE,
    content: '# Legal Notice\n\nSeed legal notice content.',
  },
  {
    type: LegalType.SUPPORT,
    content: '# Support\n\nContact support from the app for help.',
  },
  {
    type: LegalType.FAQ,
    content: [
      {
        question: 'How do I request legal assistance?',
        answer: 'Use SOS or contact support from the app.',
        sequence: 1,
      },
      {
        question: 'Can I upload legal documents?',
        answer:
          'Upload documents through the universal files flow, then link them where needed.',
        sequence: 2,
      },
    ],
  },
] as const;

export async function seedLegal(prisma: PrismaClient): Promise<void> {
  for (const page of legalPages) {
    await prisma.legal.upsert({
      where: { type: page.type },
      create: page,
      update: { content: page.content },
    });
  }
}
