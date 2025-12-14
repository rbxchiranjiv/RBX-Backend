import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('feature-flags')
  getFeatureFlags() {
    return this.adminService.getFeatureFlags();
  }

  @Patch('feature-flags')
  updateFlag(@Body() payload: UpdateFeatureFlagDto) {
    return this.adminService.updateFeatureFlag(payload);
  }
}
