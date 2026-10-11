import { Injectable } from '@nestjs/common';
import type { FileObject, FileStatus, FileVisibility } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

export interface CreateFileObjectInput {
  ownerId: string;
  key: string;
  bucket: string;
  contentType: string;
  originalName?: string | null;
  visibility: FileVisibility;
}

export interface MarkUploadedInput {
  size: number;
}

@Injectable()
export class FileObjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateFileObjectInput): Promise<FileObject> {
    return this.prisma.fileObject.create({ data: input });
  }

  findById(id: string): Promise<FileObject | null> {
    return this.prisma.fileObject.findUnique({ where: { id } });
  }

  findByIdForOwner(id: string, ownerId: string): Promise<FileObject | null> {
    return this.prisma.fileObject.findFirst({ where: { id, ownerId } });
  }

  markUploaded(id: string, input: MarkUploadedInput): Promise<FileObject> {
    return this.prisma.fileObject.update({
      where: { id },
      data: {
        size: input.size,
        status: 'UPLOADED' satisfies FileStatus,
        confirmedAt: new Date(),
      },
    });
  }

  delete(id: string): Promise<FileObject> {
    return this.prisma.fileObject.delete({ where: { id } });
  }

  listForOwner(ownerId: string, pagination: Pagination) {
    return prismaPaginate(
      this.prisma.fileObject,
      { where: { ownerId }, orderBy: { createdAt: 'desc' } },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }
}
