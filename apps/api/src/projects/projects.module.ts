import { Module } from '@nestjs/common';
import { EligibilityService } from './eligibility.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, EligibilityService],
  // Reports (M5/M6) revalidate project eligibility at save and submit time.
  exports: [EligibilityService],
})
export class ProjectsModule {}
