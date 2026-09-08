import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ReportContentService } from './report-content.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportContentService],
  // The review workflow (M6) clones content into a new version.
  exports: [ReportContentService, ReportsService],
})
export class ReportsModule {}
