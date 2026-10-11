import { Injectable } from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import { DriverRepository } from '@/modules/drivers/repositories/driver.repository';

@Injectable()
export class AdminDriverService {
  constructor(private readonly drivers: DriverRepository) {}

  list(pagination: Pagination, filters: { search?: string } = {}) {
    return this.drivers.listForAdmin(pagination, filters);
  }
}
