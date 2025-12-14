import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { ScheduleMatchDto } from './dto/schedule-match.dto';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('schedule')
  schedule(@Body() payload: ScheduleMatchDto) {
    return this.matchesService.schedule(payload);
  }

  @Get(':id')
  getStatus(@Param('id') id: string) {
    return this.matchesService.getStatus(id);
  }
}
