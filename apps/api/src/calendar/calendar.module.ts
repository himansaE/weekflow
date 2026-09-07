import { Global, Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';

/** Global: the reporting calendar is needed by projects, reports and dashboards. */
@Global()
@Module({
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
