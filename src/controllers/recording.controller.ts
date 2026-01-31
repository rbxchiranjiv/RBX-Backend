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
import { RecordingService } from '../services/recording.service';
import {
  CreateRecordingDto,
  UpdateRecordingDto,
  RecordingQueryDto,
  StartRecordingDto,
  StopRecordingDto,
  CompleteRecordingDto,
  FailRecordingDto,
  AddClipMarkerDto,
  RecordingStatsDto,
} from '../dto/recording.dto';
import { RecordingStatus } from '../database/entities/recording.entity';
import { buildMessageResponse, buildSuccessResponse } from './http-utils';

// @ApiTags('recordings')
@Controller('recordings')
@UseGuards(JwtAuthGuard) // RolesGuard commented out until implemented
export class RecordingController {
  constructor(private readonly recordingService: RecordingService) {}

  @Post()
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Create a new recording' })
  // @ApiResponse({ status: 201, description: 'Recording created successfully' })
  // @ApiResponse({ status: 400, description: 'Bad request' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 403, description: 'Forbidden' })
  async createRecording(@Body() createDto: CreateRecordingDto) {
    const recording = await this.recordingService.create(createDto);
    return buildSuccessResponse(recording);
  }

  @Get(':id')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get recording by ID' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording found' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  async getRecording(@Param('id') id: string) {
    const recording = await this.recordingService.findById(id);
    return buildSuccessResponse(recording);
  }

  @Put(':id')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Update recording' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording updated successfully' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  // @ApiResponse({ status: 400, description: 'Cannot update recording in progress' })
  async updateRecording(
    @Param('id') id: string,
    @Body() updateDto: UpdateRecordingDto
  ) {
    const recording = await this.recordingService.update(id, updateDto as any);
    return buildSuccessResponse(recording);
  }

  @Post(':id/start')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Start recording' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording started successfully' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  // @ApiResponse({ status: 400, description: 'Recording is not in initializing status' })
  async startRecording(@Param('id') id: string) {
    const recording = await this.recordingService.startRecording(id);
    return buildSuccessResponse(recording);
  }

  @Post(':id/stop')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Stop recording' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording stopped successfully' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  // @ApiResponse({ status: 400, description: 'Recording is not in recording status' })
  async stopRecording(@Param('id') id: string) {
    const recording = await this.recordingService.stopRecording(id);
    return buildSuccessResponse(recording);
  }

  @Post(':id/complete')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Complete recording with video data' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording completed successfully' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  // @ApiResponse({ status: 400, description: 'Recording is not in processing status' })
  async completeRecording(
    @Param('id') id: string,
    @Body() completeDto: CompleteRecordingDto
  ) {
    const recording = await this.recordingService.completeRecording(id, completeDto);
    return buildSuccessResponse(recording);
  }

  @Post(':id/fail')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Mark recording as failed' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording marked as failed' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  // @ApiResponse({ status: 400, description: 'Recording is not in processing status' })
  async failRecording(
    @Param('id') id: string,
    @Body() failDto: FailRecordingDto
  ) {
    const recording = await this.recordingService.failRecording(id, failDto.errorMessage);
    return buildSuccessResponse(recording);
  }

  @Post(':id/clip-markers')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Add clip marker to recording' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Clip marker added successfully' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  async addClipMarker(
    @Param('id') id: string,
    @Body() markerDto: AddClipMarkerDto
  ) {
    await this.recordingService.addClipMarker(id, markerDto);
    return buildMessageResponse('Clip marker added successfully');
  }

  @Delete(':id')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Delete a recording' })
  // @ApiParam({ name: 'id', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Recording deleted successfully' })
  // @ApiResponse({ status: 404, description: 'Recording not found' })
  // @ApiResponse({ status: 400, description: 'Cannot delete recording in progress' })
  async deleteRecording(@Param('id') id: string) {
    await this.recordingService.delete(id);
    return buildMessageResponse('Recording deleted successfully');
  }

  @Get()
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get recordings with filters' })
  // @ApiQuery({ name: 'streamSessionId', required: false, description: 'Filter by stream session ID' })
  // @ApiQuery({ name: 'matchId', required: false, description: 'Filter by match ID' })
  // @ApiQuery({ name: 'tournamentId', required: false, description: 'Filter by tournament ID' })
  // @ApiQuery({ name: 'recordedBy', required: false, description: 'Filter by recorder ID' })
  // @ApiQuery({ name: 'status', required: false, description: 'Filter by recording status' })
  // @ApiQuery({ name: 'format', required: false, description: 'Filter by recording format' })
  // @ApiQuery({ name: 'quality', required: false, description: 'Filter by recording quality' })
  // @ApiQuery({ name: 'region', required: false, description: 'Filter by region' })
  // @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  // @ApiQuery({ name: 'offset', required: false, description: 'Offset results' })
  // @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  // @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  // @ApiResponse({ status: 200, description: 'Recordings retrieved successfully' })
  async getRecordings(@Query() queryDto: RecordingQueryDto) {
    const recordings = await this.recordingService.findMany(queryDto);
    return buildSuccessResponse(recordings);
  }

  @Get('stream/:streamSessionId')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get recordings by stream session' })
  // @ApiParam({ name: 'streamSessionId', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Recordings retrieved successfully' })
  async getRecordingsByStream(@Param('streamSessionId') streamSessionId: string) {
    const recordings = await this.recordingService.getRecordingsByStream(streamSessionId);
    return buildSuccessResponse(recordings);
  }

  @Get('stats')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get recording statistics' })
  // @ApiQuery({ name: 'recordedBy', required: false, description: 'Filter by recorder ID' })
  // @ApiResponse({ status: 200, description: 'Recording statistics retrieved successfully' })
  async getRecordingStats(@Query() queryDto: RecordingStatsDto) {
    const stats = await this.recordingService.getRecordingStats(queryDto.recordedBy);
    return buildSuccessResponse(stats);
  }
}
