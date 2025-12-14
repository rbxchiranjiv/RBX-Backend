import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';
import { HighlightService } from '../services/highlight.service';
import {
  CreateHighlightDto,
  UpdateHighlightDto,
  HighlightQueryDto,
  CompleteHighlightDto,
  ApproveHighlightDto,
  RejectHighlightDto,
  PublishHighlightDto,
  FailHighlightDto,
  UpdateHighlightEngagementDto,
  HighlightStatsDto,
} from '../dto/highlight.dto';
import { HighlightStatus } from '../database/entities/highlight.entity';

// @ApiTags('highlights')
@Controller('highlights')
@UseGuards(JwtAuthGuard) // RolesGuard commented out until implemented
export class HighlightController {
  constructor(private readonly highlightService: HighlightService) {}

  @Post()
  // @Roles('admin', 'organizer', 'streamer', 'player')
  @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Create a new highlight' })
  // @ApiResponse({ status: 201, description: 'Highlight created successfully' })
  // @ApiResponse({ status: 400, description: 'Bad request' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 403, description: 'Forbidden' })
  async createHighlight(@Body() createDto: CreateHighlightDto) {
    return this.highlightService.create(createDto);
  }

  @Get(':id')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get highlight by ID' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight found' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  async getHighlight(@Param('id') id: string) {
    return this.highlightService.findById(id);
  }

  @Put(':id')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Update highlight' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight updated successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Cannot update highlight while processing' })
  async updateHighlight(
    @Param('id') id: string,
    @Body() updateDto: UpdateHighlightDto
  ) {
    return this.highlightService.update(id, updateDto as any);
  }

  @Post(':id/complete')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Complete highlight processing with video data' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight completed successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Highlight is not in processing status' })
  async completeHighlight(
    @Param('id') id: string,
    @Body() completeDto: CompleteHighlightDto
  ) {
    return this.highlightService.completeProcessing(id, completeDto);
  }

  @Post(':id/approve')
  // @Roles('admin', 'organizer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Approve a highlight' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight approved successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Highlight must be ready before approval' })
  async approveHighlight(
    @Param('id') id: string,
    @Body() approveDto: ApproveHighlightDto
  ) {
    return this.highlightService.approveHighlight(id, approveDto.approvedBy, approveDto.approvedAt ? new Date(approveDto.approvedAt) : undefined);
  }

  @Post(':id/reject')
  // @Roles('admin', 'organizer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Reject a highlight' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight rejected successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Highlight must be ready before rejection' })
  async rejectHighlight(
    @Param('id') id: string,
    @Body() rejectDto: RejectHighlightDto
  ) {
    return this.highlightService.rejectHighlight(id, rejectDto.approvedBy, rejectDto.rejectionReason);
  }

  @Post(':id/publish')
  // @Roles('admin', 'organizer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Publish a highlight' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight published successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Highlight must be approved before publishing' })
  async publishHighlight(@Param('id') id: string) {
    return this.highlightService.publishHighlight(id);
  }

  @Post(':id/fail')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Mark highlight processing as failed' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight marked as failed' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Highlight is not in processing status' })
  async failHighlight(
    @Param('id') id: string,
    @Body() failDto: FailHighlightDto
  ) {
    return this.highlightService.failProcessing(id, failDto.errorMessage);
  }

  @Post(':id/engagement')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Update highlight engagement metrics' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Engagement metrics updated successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  async updateEngagement(
    @Param('id') id: string,
    @Body() engagementDto: UpdateHighlightEngagementDto
  ) {
    await this.highlightService.updateEngagement(id, engagementDto);
    return { message: 'Engagement metrics updated successfully' };
  }

  @Delete(':id')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Delete a highlight' })
  // @ApiParam({ name: 'id', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Highlight deleted successfully' })
  // @ApiResponse({ status: 404, description: 'Highlight not found' })
  // @ApiResponse({ status: 400, description: 'Cannot delete highlight while processing' })
  async deleteHighlight(@Param('id') id: string) {
    await this.highlightService.delete(id);
    return { message: 'Highlight deleted successfully' };
  }

  @Get()
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get highlights with filters' })
  // @ApiQuery({ name: 'streamSessionId', required: false, description: 'Filter by stream session ID' })
  // @ApiQuery({ name: 'matchId', required: false, description: 'Filter by match ID' })
  // @ApiQuery({ name: 'tournamentId', required: false, description: 'Filter by tournament ID' })
  // @ApiQuery({ name: 'playerId', required: false, description: 'Filter by player ID' })
  // @ApiQuery({ name: 'createdBy', required: false, description: 'Filter by creator ID' })
  // @ApiQuery({ name: 'status', required: false, description: 'Filter by highlight status' })
  // @ApiQuery({ name: 'type', required: false, description: 'Filter by highlight type' })
  // @ApiQuery({ name: 'source', required: false, description: 'Filter by highlight source' })
  // @ApiQuery({ name: 'region', required: false, description: 'Filter by region' })
  // @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  // @ApiQuery({ name: 'offset', required: false, description: 'Offset results' })
  // @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  // @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  // @ApiResponse({ status: 200, description: 'Highlights retrieved successfully' })
  async getHighlights(@Query() queryDto: HighlightQueryDto) {
    return this.highlightService.findMany(queryDto);
  }

  @Get('stream/:streamSessionId')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get highlights by stream session' })
  // @ApiParam({ name: 'streamSessionId', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Highlights retrieved successfully' })
  async getHighlightsByStream(@Param('streamSessionId') streamSessionId: string) {
    return this.highlightService.getHighlightsByStream(streamSessionId);
  }

  @Get('player/:playerId')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get highlights by player' })
  // @ApiParam({ name: 'playerId', description: 'Player user ID' })
  // @ApiResponse({ status: 200, description: 'Highlights retrieved successfully' })
  async getHighlightsByPlayer(@Param('playerId') playerId: string) {
    return this.highlightService.getHighlightsByPlayer(playerId);
  }

  @Get('pending')
  // @Roles('admin', 'organizer')
  // @ApiOperation({ summary: 'Get pending highlights for approval' })
  // @ApiResponse({ status: 200, description: 'Pending highlights retrieved successfully' })
  async getPendingHighlights() {
    return this.highlightService.getPendingHighlights();
  }

  @Get('stats')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get highlight statistics' })
  // @ApiQuery({ name: 'createdBy', required: false, description: 'Filter by creator ID' })
  // @ApiResponse({ status: 200, description: 'Highlight statistics retrieved successfully' })
  async getHighlightStats(@Query() queryDto: HighlightStatsDto) {
    return this.highlightService.getHighlightStats(queryDto.createdBy);
  }
}
