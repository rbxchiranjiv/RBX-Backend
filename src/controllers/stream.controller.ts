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
import { StreamSessionService } from '../services/stream-session.service';
import {
  CreateStreamSessionDto,
  UpdateStreamSessionDto,
  StreamSessionQueryDto,
  StartStreamDto,
  EndStreamDto,
  UpdateViewerCountDto,
  AddHighlightMarkerDto,
  StreamStatsDto,
} from '../dto/stream.dto';
import { StreamStatus, StreamType } from '../database/entities/stream-session.entity';
import { buildMessageResponse, buildSuccessResponse } from './http-utils';

// @ApiTags('streams')
@Controller('streams')
@UseGuards(JwtAuthGuard) // RolesGuard commented out until implemented
export class StreamController {
  constructor(private readonly streamSessionService: StreamSessionService) {}

  @Post()
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Create a new stream session' })
  // @ApiResponse({ status: 201, description: 'Stream session created successfully' })
  // @ApiResponse({ status: 400, description: 'Bad request' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 403, description: 'Forbidden' })
  async createStreamSession(@Body() createDto: CreateStreamSessionDto) {
    const stream = await this.streamSessionService.create(createDto as any);
    return buildSuccessResponse(stream);
  }

  @Get(':id')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get stream session by ID' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Stream session found' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  async getStreamSession(@Param('id') id: string) {
    const stream = await this.streamSessionService.findById(id);
    return buildSuccessResponse(stream);
  }

  @Put(':id')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Update stream session' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Stream session updated successfully' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  // @ApiResponse({ status: 400, description: 'Cannot update live stream' })
  async updateStreamSession(
    @Param('id') id: string,
    @Body() updateDto: UpdateStreamSessionDto
  ) {
    const stream = await this.streamSessionService.update(id, updateDto as any);
    return buildSuccessResponse(stream);
  }

  @Post(':id/start')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Start a stream session' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Stream started successfully' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  // @ApiResponse({ status: 400, description: 'Stream is not in pending status' })
  async startStream(@Param('id') id: string) {
    const stream = await this.streamSessionService.startStream(id);
    return buildSuccessResponse(stream);
  }

  @Post(':id/end')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'End a stream session' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Stream ended successfully' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  // @ApiResponse({ status: 400, description: 'Stream is not live' })
  async endStream(
    @Param('id') id: string,
    @Body() endDto: EndStreamDto
  ) {
    const stream = await this.streamSessionService.endStream(id, endDto.reason);
    return buildSuccessResponse(stream);
  }

  @Post(':id/viewer-count')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Update viewer count for a stream' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Viewer count updated successfully' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  async updateViewerCount(
    @Param('id') id: string,
    @Body() updateDto: UpdateViewerCountDto
  ) {
    await this.streamSessionService.updateViewerCount(id, updateDto.viewerCount);
    return buildMessageResponse('Viewer count updated successfully');
  }

  @Post(':id/highlight-markers')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Add highlight marker to stream' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Highlight marker added successfully' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  async addHighlightMarker(
    @Param('id') id: string,
    @Body() markerDto: AddHighlightMarkerDto
  ) {
    const marker = await this.streamSessionService.addHighlightMarker(id, {
      timestamp: markerDto.timestamp,
      type: markerDto.type as 'kill' | 'death' | 'win' | 'clutch' | 'ace' | 'multikill' | 'custom',
      description: markerDto.description,
      confidence: markerDto.confidence,
      metadata: markerDto.metadata
    });
    return buildSuccessResponse(marker);
  }

  @Delete(':id')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Delete a stream session' })
  // @ApiParam({ name: 'id', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Stream session deleted successfully' })
  // @ApiResponse({ status: 404, description: 'Stream session not found' })
  // @ApiResponse({ status: 400, description: 'Cannot delete live stream' })
  async deleteStreamSession(@Param('id') id: string) {
    await this.streamSessionService.delete(id);
    return buildMessageResponse('Stream session deleted successfully');
  }

  @Get()
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get stream sessions with filters' })
  // @ApiQuery({ name: 'tournamentId', required: false, description: 'Filter by tournament ID' })
  // @ApiQuery({ name: 'matchId', required: false, description: 'Filter by match ID' })
  // @ApiQuery({ name: 'streamerId', required: false, description: 'Filter by streamer ID' })
  // @ApiQuery({ name: 'type', required: false, description: 'Filter by stream type' })
  // @ApiQuery({ name: 'status', required: false, description: 'Filter by stream status' })
  // @ApiQuery({ name: 'region', required: false, description: 'Filter by region' })
  // @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  // @ApiQuery({ name: 'offset', required: false, description: 'Offset results' })
  // @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  // @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  // @ApiResponse({ status: 200, description: 'Stream sessions retrieved successfully' })
  async getStreamSessions(@Query() queryDto: StreamSessionQueryDto) {
    const streams = await this.streamSessionService.findMany(queryDto);
    return buildSuccessResponse(streams);
  }

  @Get('active')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get all active streams' })
  // @ApiResponse({ status: 200, description: 'Active streams retrieved successfully' })
  async getActiveStreams() {
    const streams = await this.streamSessionService.getActiveStreams();
    return buildSuccessResponse(streams);
  }

  @Get('stats/:streamerId')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get streamer statistics' })
  // @ApiParam({ name: 'streamerId', description: 'Streamer user ID' })
  // @ApiResponse({ status: 200, description: 'Streamer statistics retrieved successfully' })
  // @ApiResponse({ status: 404, description: 'Streamer not found' })
  async getStreamerStats(@Param('streamerId') streamerId: string) {
    const stats = await this.streamSessionService.getStreamerStats(streamerId);
    return buildSuccessResponse(stats);
  }
}
