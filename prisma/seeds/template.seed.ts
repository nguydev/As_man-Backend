import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '../generated/prisma/client';

type DashboardLetterTemplate = {
  id: string;
  name: string;
  category: string;
  updated?: string;
  content: string;
};

function dashboardTemplatesPath() {
  if (process.env.ASMAN_DASHBOARD_TEMPLATES_PATH) {
    return resolve(process.env.ASMAN_DASHBOARD_TEMPLATES_PATH);
  }

  return resolve(
    process.cwd(),
    '../asman-dashboard/src/data/letterTemplates.json',
  );
}

function loadDashboardTemplates(): DashboardLetterTemplate[] {
  const path = dashboardTemplatesPath();
  if (!existsSync(path)) {
    throw new Error(
      `Dashboard letter templates not found at ${path}. Set ASMAN_DASHBOARD_TEMPLATES_PATH or keep asman-dashboard as a sibling of asman-backend-api.`,
    );
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Dashboard letter templates file is empty: ${path}`);
  }

  return parsed.map((row, index) => {
    const item = row as Partial<DashboardLetterTemplate>;
    if (!item.name?.trim() || !item.content?.trim()) {
      throw new Error(
        `Invalid dashboard template at index ${index}: name and content are required`,
      );
    }
    return {
      id: item.id?.trim() || `tpl-${index + 1}`,
      name: item.name.trim(),
      category: item.category?.trim() || 'General',
      updated: item.updated,
      content: item.content.trim(),
    };
  });
}

export async function seedTemplates(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@asman.com' },
    select: { id: true },
  });
  if (!admin) {
    throw new Error(
      'seedTemplates requires admin@asman.com (run seedAdmin first)',
    );
  }

  const templates = loadDashboardTemplates();
  for (const template of templates) {
    await prisma.template.upsert({
      where: { title: template.name },
      create: {
        title: template.name,
        content: template.content,
        addedById: admin.id,
      },
      update: {
        content: template.content,
      },
    });
  }

  console.log(
    `Seeded ${templates.length} templates from ${dashboardTemplatesPath()}`,
  );
}
