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
import { CdnUploadService } from '../services/cdn-upload.service';
import {
  CreateUploadDto,
  UpdateUploadDto,
  UploadQueryDto,
  StartUploadDto,
  CompleteUploadDto,
  FinalizeUploadDto,
  FailUploadDto,
  GenerateSignedUrlDto,
  UpdateUploadAnalyticsDto,
  UploadStatsDto,
} from '../dto/cdn-upload.dto';
import { UploadStatus } from '../database/entities/cdn-upload.entity';

// @ApiTags('cdn-uploads')
@Controller('cdn-uploads')
@UseGuards(JwtAuthGuard) // RolesGuard commented out until implemented
export class CdnUploadController {
  constructor(private readonly cdnUploadService: CdnUploadService) {}

  @Post()
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Create a new CDN upload' })
  // @ApiResponse({ status: 201, description: 'Upload created successfully' })
  // @ApiResponse({ status: 400, description: 'Bad request' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 403, description: 'Forbidden' })
  async createUpload(@Body() createDto: CreateUploadDto) {
    return this.cdnUploadService.create(createDto as any);
  }

  @Get(':id')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get upload by ID' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload found' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  async getUpload(@Param('id') id: string) {
    return this.cdnUploadService.findById(id);
  }

  @Put(':id')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Update upload' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload updated successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  // @ApiResponse({ status: 400, description: 'Cannot update completed upload' })
  async updateUpload(
    @Param('id') id: string,
    @Body() updateDto: UpdateUploadDto
  ) {
    // Convert DTO to service input format
    const updateInput: any = {
      status: updateDto.status,
      cdnUrl: updateDto.cdnUrl,
      thumbnailUrl: updateDto.thumbnailUrl,
      previewUrl: updateDto.previewUrl,
      downloadUrl: updateDto.downloadUrl,
      embedUrl: updateDto.embedUrl,
      metadata: updateDto.metadata,
    };
    
    // Convert string date to Date if present
    if (updateDto.expiresAt) {
      updateInput.expiresAt = new Date(updateDto.expiresAt);
    }
    
    return this.cdnUploadService.update(id, updateInput);
  }

  @Post(':id/start')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Start upload process' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload started successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  // @ApiResponse({ status: 400, description: 'Upload is not in pending status' })
  async startUpload(@Param('id') id: string) {
    return this.cdnUploadService.startUpload(id);
  }

  @Post(':id/complete')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Complete upload with CDN URLs' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload completed successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  // @ApiResponse({ status: 400, description: 'Upload is not in uploading status' })
  async completeUpload(
    @Param('id') id: string,
    @Body() completeDto: CompleteUploadDto
  ) {
    return this.cdnUploadService.completeUpload(id, completeDto);
  }

  @Post(':id/finalize')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Finalize upload processing' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload finalized successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  // @ApiResponse({ status: 400, description: 'Upload is not in processing status' })
  async finalizeUpload(@Param('id') id: string) {
    return this.cdnUploadService.finalizeUpload(id);
  }

  @Post(':id/fail')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Mark upload as failed' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload marked as failed' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  async failUpload(
    @Param('id') id: string,
    @Body() failDto: FailUploadDto
  ) {
    return this.cdnUploadService.failUpload(id, failDto.errorMessage);
  }

  @Post(':id/signed-url')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Generate signed URL for download' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Signed URL generated successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  // @ApiResponse({ status: 400, description: 'Upload must be completed to generate signed URL' })
  async generateSignedUrl(
    @Param('id') id: string,
    @Body() signedUrlDto: GenerateSignedUrlDto
  ) {
    const signedUrl = await this.cdnUploadService.generateSignedUrl(id, signedUrlDto.expiryMinutes);
    return { signedUrl };
  }

  @Post(':id/analytics')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Update upload analytics' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Analytics updated successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  async updateAnalytics(
    @Param('id') id: string,
    @Body() analyticsDto: UpdateUploadAnalyticsDto
  ) {
    await this.cdnUploadService.updateAnalytics(id, analyticsDto);
    return { message: 'Analytics updated successfully' };
  }

  @Delete(':id')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Delete an upload' })
  // @ApiParam({ name: 'id', description: 'Upload ID' })
  // @ApiResponse({ status: 200, description: 'Upload deleted successfully' })
  // @ApiResponse({ status: 404, description: 'Upload not found' })
  // @ApiResponse({ status: 400, description: 'Cannot delete upload in progress' })
  async deleteUpload(@Param('id') id: string) {
    await this.cdnUploadService.delete(id);
    return { message: 'Upload deleted successfully' };
  }

  @Get()
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get uploads with filters' })
  // @ApiQuery({ name: 'recordingId', required: false, description: 'Filter by recording ID' })
  // @ApiQuery({ name: 'highlightId', required: false, description: 'Filter by highlight ID' })
  // @ApiQuery({ name: 'uploadedBy', required: false, description: 'Filter by uploader ID' })
  // @ApiQuery({ name: 'status', required: false, description: 'Filter by upload status' })
  // @ApiQuery({ name: 'type', required: false, description: 'Filter by upload type' })
  // @ApiQuery({ name: 'provider', required: false, description: 'Filter by storage provider' })
  // @ApiQuery({ name: 'region', required: false, description: 'Filter by region' })
  // @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  // @ApiQuery({ name: 'offset', required: false, description: 'Offset results' })
  // @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  // @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  // @ApiResponse({ status: 200, description: 'Uploads retrieved successfully' })
  async getUploads(@Query() queryDto: UploadQueryDto) {
    return this.cdnUploadService.findMany(queryDto);
  }

  @Get('recording/:recordingId')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get uploads by recording' })
  // @ApiParam({ name: 'recordingId', description: 'Recording ID' })
  // @ApiResponse({ status: 200, description: 'Uploads retrieved successfully' })
  async getUploadsByRecording(@Param('recordingId') recordingId: string) {
    return this.cdnUploadService.getUploadsByRecording(recordingId);
  }

  @Get('highlight/:highlightId')
  // @Roles('admin', 'organizer', 'streamer', 'player')
  // @ApiOperation({ summary: 'Get uploads by highlight' })
  // @ApiParam({ name: 'highlightId', description: 'Highlight ID' })
  // @ApiResponse({ status: 200, description: 'Uploads retrieved successfully' })
  async getUploadsByHighlight(@Param('highlightId') highlightId: string) {
    return this.cdnUploadService.getUploadsByHighlight(highlightId);
  }

  @Get('stats')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get upload statistics' })
  // @ApiQuery({ name: 'uploadedBy', required: false, description: 'Filter by uploader ID' })
  // @ApiResponse({ status: 200, description: 'Upload statistics retrieved successfully' })
  async getUploadStats(@Query() queryDto: UploadStatsDto) {
    return this.cdnUploadService.getUploadStats(queryDto.uploadedBy);
  }
}
