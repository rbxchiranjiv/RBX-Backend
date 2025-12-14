import {
  Controller,
  Get,
  Post,
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
import { StreamWebhookService } from '../services/stream-webhook.service';
import {
  CreateWebhookDto,
  WebhookQueryDto,
  DeliverWebhookDto,
  RetryWebhookDto,
  FailWebhookDto,
  WebhookStatsDto,
} from '../dto/webhook.dto';
import { WebhookStatus } from '../database/entities/stream-webhook.entity';

// @ApiTags('stream-webhooks')
@Controller('stream-webhooks')
@UseGuards(JwtAuthGuard) // RolesGuard commented out until implemented
export class StreamWebhookController {
  constructor(private readonly streamWebhookService: StreamWebhookService) {}

  @Post()
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Create a new webhook' })
  // @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  // @ApiResponse({ status: 400, description: 'Bad request' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 403, description: 'Forbidden' })
  async createWebhook(@Body() createDto: CreateWebhookDto) {
    return this.streamWebhookService.create(createDto);
  }

  @Get(':id')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get webhook by ID' })
  // @ApiParam({ name: 'id', description: 'Webhook ID' })
  // @ApiResponse({ status: 200, description: 'Webhook found' })
  // @ApiResponse({ status: 404, description: 'Webhook not found' })
  async getWebhook(@Param('id') id: string) {
    return this.streamWebhookService.findById(id);
  }

  @Post(':id/deliver')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Manually deliver a webhook' })
  // @ApiParam({ name: 'id', description: 'Webhook ID' })
  // @ApiResponse({ status: 200, description: 'Webhook delivered successfully' })
  // @ApiResponse({ status: 404, description: 'Webhook not found' })
  // @ApiResponse({ status: 400, description: 'Webhook is not in deliverable status' })
  async deliverWebhook(@Param('id') id: string) {
    return this.streamWebhookService.deliverWebhook(id);
  }

  @Post(':id/retry')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Retry a failed webhook' })
  // @ApiParam({ name: 'id', description: 'Webhook ID' })
  // @ApiResponse({ status: 200, description: 'Webhook retry initiated successfully' })
  // @ApiResponse({ status: 404, description: 'Webhook not found' })
  // @ApiResponse({ status: 400, description: 'Only failed webhooks can be retried' })
  async retryWebhook(@Param('id') id: string) {
    return this.streamWebhookService.retryWebhook(id);
  }

  @Post(':id/fail')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Mark webhook as failed' })
  // @ApiParam({ name: 'id', description: 'Webhook ID' })
  // @ApiResponse({ status: 200, description: 'Webhook marked as failed' })
  // @ApiResponse({ status: 404, description: 'Webhook not found' })
  async failWebhook(
    @Param('id') id: string,
    @Body() failDto: FailWebhookDto
  ) {
    return this.streamWebhookService.failWebhook(id, failDto.errorMessage);
  }

  @Delete(':id')
  // @Roles('admin', 'organizer', 'streamer')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Delete a webhook' })
  // @ApiParam({ name: 'id', description: 'Webhook ID' })
  // @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  // @ApiResponse({ status: 404, description: 'Webhook not found' })
  // @ApiResponse({ status: 400, description: 'Cannot delete webhook while processing' })
  async deleteWebhook(@Param('id') id: string) {
    await this.streamWebhookService.delete(id);
    return { message: 'Webhook deleted successfully' };
  }

  @Get()
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get webhooks with filters' })
  // @ApiQuery({ name: 'streamSessionId', required: false, description: 'Filter by stream session ID' })
  // @ApiQuery({ name: 'recordingId', required: false, description: 'Filter by recording ID' })
  // @ApiQuery({ name: 'highlightId', required: false, description: 'Filter by highlight ID' })
  // @ApiQuery({ name: 'uploadId', required: false, description: 'Filter by upload ID' })
  // @ApiQuery({ name: 'type', required: false, description: 'Filter by webhook type' })
  // @ApiQuery({ name: 'status', required: false, description: 'Filter by webhook status' })
  // @ApiQuery({ name: 'provider', required: false, description: 'Filter by webhook provider' })
  // @ApiQuery({ name: 'region', required: false, description: 'Filter by region' })
  // @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  // @ApiQuery({ name: 'offset', required: false, description: 'Offset results' })
  // @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  // @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  // @ApiResponse({ status: 200, description: 'Webhooks retrieved successfully' })
  async getWebhooks(@Query() queryDto: WebhookQueryDto) {
    return this.streamWebhookService.findMany(queryDto);
  }

  @Get('stream/:streamSessionId')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get webhooks by stream session' })
  // @ApiParam({ name: 'streamSessionId', description: 'Stream session ID' })
  // @ApiResponse({ status: 200, description: 'Webhooks retrieved successfully' })
  async getWebhooksByStream(@Param('streamSessionId') streamSessionId: string) {
    return this.streamWebhookService.getWebhooksByStream(streamSessionId);
  }

  @Get('pending')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get pending webhooks for delivery' })
  // @ApiResponse({ status: 200, description: 'Pending webhooks retrieved successfully' })
  async getPendingWebhooks() {
    return this.streamWebhookService.getPendingWebhooks();
  }

  @Get('stats')
  // @Roles('admin', 'organizer', 'streamer')
  // @ApiOperation({ summary: 'Get webhook statistics' })
  // @ApiResponse({ status: 200, description: 'Webhook statistics retrieved successfully' })
  async getWebhookStats() {
    return this.streamWebhookService.getWebhookStats();
  }
}
