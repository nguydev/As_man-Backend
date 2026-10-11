import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateDriverProfileDto } from '@/modules/drivers/dto/driver.dto';
import { DriverRepository } from '@/modules/drivers/repositories/driver.repository';
import locals from '@/locals';

@Injectable()
export class DriverProfileService {
  constructor(private readonly drivers: DriverRepository) {}

  async get(userId: string) {
    const driver = await this.drivers.findByUserId(userId);
    if (!driver) throw new NotFoundException(locals.drivers.driver_not_found);
    return driver;
  }

  async update(userId: string, dto: UpdateDriverProfileDto) {
    await this.get(userId);
    return this.drivers.updateByUserId(userId, dto);
  }

  async remove(userId: string): Promise<void> {
    await this.get(userId);
    await this.drivers.softDeleteByUserId(userId);
  }
}
