import { Injectable } from '@nestjs/common';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

export interface CreateVaultDocumentInput {
  fileObjectId: string;
  name?: string;
  linkedCaseId?: string;
}

@Injectable()
export class VaultRepository {
  constructor(private readonly prisma: PrismaService) {}
  findDriverByUser(userId: string) {
    return this.prisma.driver.findFirst({
      where: { userId, status: { not: 'DELETED' } },
    });
  }
  findOrganizationDriver(id: string, organizationId: string) {
    return this.prisma.driver.findFirst({
      where: {
        id,
        status: { not: 'DELETED' },
        organizationMembers: {
          some: { organizationId, role: 'DRIVER', status: 'ACTIVE' },
        },
      },
    });
  }
  findDriver(id: string) {
    return this.prisma.driver.findFirst({
      where: { id, status: { not: 'DELETED' } },
      select: { id: true },
    });
  }
  findOrganization(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
  }
  create(
    input: CreateVaultDocumentInput & {
      driverId?: string;
      organizationId?: string;
    },
  ) {
    return this.prisma.vaultDocument.create({
      data: {
        driverId: input.driverId,
        organizationId: input.organizationId,
        fileObjectId: input.fileObjectId,
        name: input.name,
        linkedCaseId: input.linkedCaseId,
      },
      include: { fileObject: true, linkedCase: true },
    });
  }
  createDriver(driverId: string, input: CreateVaultDocumentInput) {
    return this.prisma.vaultDocument.create({
      data: {
        driverId,
        fileObjectId: input.fileObjectId,
        name: input.name,
        linkedCaseId: input.linkedCaseId,
      },
      include: { fileObject: true },
    });
  }
  createOrganization(organizationId: string, input: CreateVaultDocumentInput) {
    return this.prisma.vaultDocument.create({
      data: {
        organizationId,
        fileObjectId: input.fileObjectId,
        name: input.name,
        linkedCaseId: input.linkedCaseId,
      },
      include: { fileObject: true },
    });
  }
  list(driverId: string, pagination: Pagination) {
    return prismaPaginate(
      this.prisma.vaultDocument,
      {
        where: { driverId },
        include: { fileObject: true, linkedCase: true },
        orderBy: { uploadedAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['uploadedAt', 'updatedAt'],
        defaultSortField: 'uploadedAt',
        defaultSortDirection: 'desc',
      },
    );
  }
  listOrganization(organizationId: string, pagination: Pagination) {
    return prismaPaginate(
      this.prisma.vaultDocument,
      {
        where: { organizationId },
        include: { fileObject: true, linkedCase: true },
        orderBy: { uploadedAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['uploadedAt', 'updatedAt'],
        defaultSortField: 'uploadedAt',
        defaultSortDirection: 'desc',
      },
    );
  }
  find(id: string) {
    return this.prisma.vaultDocument.findUnique({
      where: { id },
      include: { fileObject: true },
    });
  }
  findOrganizationDocument(id: string, organizationId: string) {
    return this.prisma.vaultDocument.findFirst({
      where: {
        id,
        OR: [
          { organizationId },
          {
            driver: {
              organizationMembers: {
                some: { organizationId, role: 'DRIVER', status: 'ACTIVE' },
              },
            },
          },
        ],
      },
      include: { fileObject: true },
    });
  }
  findOrganizationDriverDocument(
    id: string,
    organizationId: string,
    driverId: string,
  ) {
    return this.prisma.vaultDocument.findFirst({
      where: {
        id,
        driverId,
        driver: {
          organizationMembers: {
            some: { organizationId, role: 'DRIVER', status: 'ACTIVE' },
          },
        },
      },
      include: { fileObject: true },
    });
  }
  remove(id: string) {
    return this.prisma.vaultDocument.delete({ where: { id } });
  }
  linkCase(id: string, caseId: string) {
    return this.prisma.vaultDocument.update({
      where: { id },
      data: { linkedCaseId: caseId },
    });
  }
}
