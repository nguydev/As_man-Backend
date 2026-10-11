import { Injectable } from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import { FileObjectRepository } from '@/core/files/repositories/file-object.repository';
import { toFileView } from '@/core/files/files.presenter';

@Injectable()
export class ListFilesService {
  constructor(private readonly files: FileObjectRepository) {}

  async execute(ownerId: string, pagination: Pagination) {
    const result = await this.files.listForOwner(ownerId, pagination);
    return { ...result, data: result.data.map(toFileView) };
  }
}
