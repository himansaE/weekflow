import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ReportContentService } from './report-content.service';
import { ReportWorkflowService } from './report-workflow.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportContentService, ReportWorkflowService],
  // The review workflow (M6) clones content into a new version.
  exports: [ReportContentService, ReportsService, ReportWorkflowService],
})
export class ReportsModule {}
