# Streaming Engine API Documentation

## Overview

The Streaming Engine provides comprehensive APIs for managing live streams, recordings, highlights, CDN uploads, and webhooks. This document describes all available endpoints, their parameters, and response formats.

## Base URL

```
https://api.rbx.com/v1
```

## Authentication

All endpoints require JWT authentication with the following roles:
- `admin`: Full access to all streaming features
- `organizer`: Can manage streams for their tournaments
- `streamer`: Can manage their own streams
- `player`: Can view public streams and highlights

## Stream Sessions API

### Create Stream Session

**POST** `/streams`

Creates a new stream session for live broadcasting.

**Required Roles:** `admin`, `organizer`, `streamer`

**Request Body:**
```json
{
  "tournamentId": "uuid",
  "matchId": "uuid",
  "streamerId": "uuid",
  "type": "match|tournament|practice|custom",
  "title": "string",
  "description": "string",
  "quality": "auto|1080p|720p|480p|360p",
  "scheduledFor": "ISO 8601 datetime",
  "metadata": {
    "platform": "string",
    "platformStreamId": "string",
    "recordingEnabled": true,
    "autoHighlightEnabled": true,
    "tags": ["string"],
    "language": "string"
  },
  "region": "string"
}
```

**Response:**
```json
{
  "id": "uuid",
  "streamerId": "uuid",
  "type": "match",
  "status": "pending",
  "title": "string",
  "description": "string",
  "quality": "auto",
  "viewerCount": 0,
  "maxViewers": 0,
  "metadata": {},
  "streamStats": {},
  "recordingMetadata": {},
  "highlightMarkers": [],
  "scheduledFor": "ISO 8601 datetime",
  "startedAt": "ISO 8601 datetime",
  "endedAt": "ISO 8601 datetime",
  "archivedAt": "ISO 8601 datetime",
  "region": "global",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

### Get Stream Session

**GET** `/streams/{id}`

Retrieves a specific stream session by ID.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Response:** Stream session object (same as create response)

### Update Stream Session

**PUT** `/streams/{id}`

Updates an existing stream session. Cannot update live streams.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "quality": "auto|1080p|720p|480p|360p",
  "metadata": {},
  "scheduledFor": "ISO 8601 datetime"
}
```

**Response:** Updated stream session object

### Start Stream

**POST** `/streams/{id}/start`

Starts a stream session, changing status from `pending` to `live`.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Response:** Updated stream session with `live` status

### End Stream

**POST** `/streams/{id}/end`

Ends a live stream session, calculating duration and statistics.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Request Body:**
```json
{
  "streamSessionId": "uuid",
  "reason": "string"
}
```

**Response:** Updated stream session with `ended` status

### Update Viewer Count

**POST** `/streams/{id}/viewer-count`

Updates the current viewer count for a live stream.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Request Body:**
```json
{
  "streamSessionId": "uuid",
  "viewerCount": 0
}
```

**Response:** Success message

### Add Highlight Marker

**POST** `/streams/{id}/highlight-markers`

Adds a highlight marker to a stream for later processing.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Request Body:**
```json
{
  "streamSessionId": "uuid",
  "timestamp": 0,
  "type": "string",
  "description": "string",
  "confidence": 0.95,
  "metadata": {}
}
```

**Response:** Success message

### Delete Stream Session

**DELETE** `/streams/{id}`

Deletes a stream session. Cannot delete live streams.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Stream session ID

**Response:** Success message

### List Stream Sessions

**GET** `/streams`

Retrieves a paginated list of stream sessions with filtering options.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Query Parameters:**
- `tournamentId` (string, optional): Filter by tournament ID
- `matchId` (string, optional): Filter by match ID
- `streamerId` (string, optional): Filter by streamer ID
- `type` (string, optional): Filter by stream type
- `status` (string, optional): Filter by stream status
- `region` (string, optional): Filter by region
- `limit` (number, optional): Limit results (default: 50, max: 100)
- `offset` (number, optional): Offset results (default: 0)
- `sortBy` (string, optional): Sort by field (default: createdAt)
- `sortOrder` (string, optional): Sort order (asc|desc, default: desc)

**Response:**
```json
{
  "sessions": [StreamSession],
  "total": 100
}
```

### Get Active Streams

**GET** `/streams/active`

Retrieves all currently active (live) streams.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Response:** Array of active stream sessions

### Get Streamer Statistics

**GET** `/streams/stats/{streamerId}`

Retrieves statistics for a specific streamer.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `streamerId` (string, required): Streamer user ID

**Response:**
```json
{
  "totalSessions": 10,
  "totalDuration": 36000,
  "totalViews": 50000,
  "avgViewers": 1250,
  "maxViewers": 5000
}
```

## Recordings API

### Create Recording

**POST** `/recordings`

Creates a new recording for a stream session.

**Required Roles:** `admin`, `organizer`, `streamer`

**Request Body:**
```json
{
  "streamSessionId": "uuid",
  "matchId": "uuid",
  "tournamentId": "uuid",
  "recordedBy": "uuid",
  "title": "string",
  "description": "string",
  "format": "mp4|webm|avi|mov",
  "quality": "auto|1080p|720p|480p|360p",
  "metadata": {
    "platform": "string",
    "platformRecordingId": "string",
    "tags": ["string"],
    "language": "string",
    "region": "string",
    "autoRecorded": true,
    "backupEnabled": true,
    "priority": 1
  },
  "region": "string"
}
```

**Response:**
```json
{
  "id": "uuid",
  "streamSessionId": "uuid",
  "matchId": "uuid",
  "tournamentId": "uuid",
  "recordedBy": "uuid",
  "status": "initializing",
  "title": "string",
  "description": "string",
  "format": "mp4",
  "quality": "auto",
  "videoUrl": "string",
  "downloadUrl": "string",
  "thumbnailUrl": "string",
  "previewUrl": "string",
  "videoMetadata": {},
  "recordingMetadata": {},
  "processingMetadata": {},
  "clipMarkers": [],
  "storageMetadata": {},
  "analytics": {},
  "metadata": {},
  "errorMessage": "string",
  "retryCount": 0,
  "lastRetryAt": "ISO 8601 datetime",
  "startedAt": "ISO 8601 datetime",
  "endedAt": "ISO 8601 datetime",
  "archivedAt": "ISO 8601 datetime",
  "expiresAt": "ISO 8601 datetime",
  "region": "global",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

### Start Recording

**POST** `/recordings/{id}/start`

Starts the recording process.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Recording ID

**Response:** Updated recording with `recording` status

### Stop Recording

**POST** `/recordings/{id}/stop`

Stops the recording and begins processing.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Recording ID

**Response:** Updated recording with `processing` status

### Complete Recording

**POST** `/recordings/{id}/complete`

Marks recording as completed with video URLs and metadata.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Recording ID

**Request Body:**
```json
{
  "recordingId": "uuid",
  "videoUrl": "string",
  "downloadUrl": "string",
  "thumbnailUrl": "string",
  "previewUrl": "string",
  "videoMetadata": {
    "resolution": "string",
    "fps": 30,
    "bitrate": 5000,
    "codec": "string",
    "aspectRatio": "string",
    "fileSize": 1048576,
    "duration": 3600,
    "audioCodec": "string",
    "audioBitrate": 128
  }
}
```

**Response:** Updated recording with `completed` status

### Fail Recording

**POST** `/recordings/{id}/fail`

Marks recording as failed with error message.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Recording ID

**Request Body:**
```json
{
  "recordingId": "uuid",
  "errorMessage": "string"
}
```

**Response:** Updated recording with `failed` status

### Add Clip Marker

**POST** `/recordings/{id}/clip-markers`

Adds a clip marker to a recording for highlight generation.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Recording ID

**Request Body:**
```json
{
  "recordingId": "uuid",
  "id": "string",
  "timestamp": 0,
  "type": "highlight|event|manual",
  "title": "string",
  "description": "string",
  "confidence": 0.95,
  "metadata": {}
}
```

**Response:** Success message

### Get Recordings by Stream

**GET** `/recordings/stream/{streamSessionId}`

Retrieves all recordings for a specific stream session.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Path Parameters:**
- `streamSessionId` (string, required): Stream session ID

**Response:** Array of recording objects

### Get Recording Statistics

**GET** `/recordings/stats`

Retrieves recording statistics.

**Required Roles:** `admin`, `organizer`, `streamer`

**Query Parameters:**
- `recordedBy` (string, optional): Filter by recorder ID

**Response:**
```json
{
  "totalRecordings": 50,
  "totalDuration": 180000,
  "totalSize": 524288000,
  "avgDuration": 3600,
  "completedRecordings": 45,
  "failedRecordings": 5
}
```

## Highlights API

### Create Highlight

**POST** `/highlights`

Creates a new video highlight from a stream session.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Request Body:**
```json
{
  "streamSessionId": "uuid",
  "matchId": "uuid",
  "tournamentId": "uuid",
  "playerId": "uuid",
  "createdBy": "uuid",
  "type": "kill|win|loss|special|custom",
  "source": "auto_generated|manual|ai_detected",
  "title": "string",
  "description": "string",
  "startTime": 0,
  "endTime": 0,
  "metadata": {
    "platform": "string",
    "platformClipId": "string",
    "tags": ["string"],
    "language": "string",
    "region": "string",
    "featured": true,
    "priority": 1,
    "autoGenerated": true
  },
  "aiMetadata": {
    "confidence": 0.95,
    "detectedEvents": [],
    "tags": [],
    "sentiment": "positive|negative|neutral",
    "excitement": 0.8
  },
  "region": "string"
}
```

**Response:**
```json
{
  "id": "uuid",
  "streamSessionId": "uuid",
  "matchId": "uuid",
  "tournamentId": "uuid",
  "playerId": "uuid",
  "createdBy": "uuid",
  "status": "processing",
  "type": "kill",
  "source": "auto_generated",
  "title": "string",
  "description": "string",
  "startTime": 0,
  "endTime": 0,
  "duration": 5,
  "thumbnailUrl": "string",
  "videoUrl": "string",
  "downloadUrl": "string",
  "embedUrl": "string",
  "videoMetadata": {},
  "processingMetadata": {},
  "aiMetadata": {},
  "engagement": {},
  "metadata": {},
  "rejectionReason": "string",
  "approvedBy": "uuid",
  "approvedAt": "ISO 8601 datetime",
  "publishedAt": "ISO 8601 datetime",
  "expiresAt": "ISO 8601 datetime",
  "region": "global",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

### Complete Highlight Processing

**POST** `/highlights/{id}/complete`

Marks highlight processing as complete with video URLs.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Highlight ID

**Request Body:**
```json
{
  "highlightId": "uuid",
  "videoUrl": "string",
  "downloadUrl": "string",
  "thumbnailUrl": "string",
  "embedUrl": "string",
  "videoMetadata": {
    "format": "string",
    "resolution": "string",
    "fps": 30,
    "bitrate": 3000,
    "fileSize": 52428800,
    "codec": "string",
    "aspectRatio": "string"
  }
}
```

**Response:** Updated highlight with `ready` status

### Approve Highlight

**POST** `/highlights/{id}/approve`

Approves a highlight for publication.

**Required Roles:** `admin`, `organizer`

**Path Parameters:**
- `id` (string, required): Highlight ID

**Request Body:**
```json
{
  "highlightId": "uuid",
  "approvedBy": "uuid",
  "approvedAt": "ISO 8601 datetime"
}
```

**Response:** Updated highlight with `approved` status

### Reject Highlight

**POST** `/highlights/{id}/reject`

Rejects a highlight with reason.

**Required Roles:** `admin`, `organizer`

**Path Parameters:**
- `id` (string, required): Highlight ID

**Request Body:**
```json
{
  "highlightId": "uuid",
  "approvedBy": "uuid",
  "rejectionReason": "string"
}
```

**Response:** Updated highlight with `rejected` status

### Publish Highlight

**POST** `/highlights/{id}/publish`

Publishes an approved highlight.

**Required Roles:** `admin`, `organizer`

**Path Parameters:**
- `id` (string, required): Highlight ID

**Response:** Updated highlight with `published` status

### Update Engagement Metrics

**POST** `/highlights/{id}/engagement`

Updates engagement metrics for a highlight.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Highlight ID

**Request Body:**
```json
{
  "highlightId": "uuid",
  "views": 1000,
  "likes": 50,
  "shares": 10,
  "downloads": 5,
  "comments": 3,
  "watchTime": 50000
}
```

**Response:** Success message

### Get Highlights by Player

**GET** `/highlights/player/{playerId}`

Retrieves all highlights for a specific player.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Path Parameters:**
- `playerId` (string, required): Player user ID

**Response:** Array of highlight objects

### Get Pending Highlights

**GET** `/highlights/pending`

Retrieves all highlights pending approval.

**Required Roles:** `admin`, `organizer`

**Response:** Array of highlight objects with `ready` status

### Get Highlight Statistics

**GET** `/highlights/stats`

Retrieves highlight statistics.

**Required Roles:** `admin`, `organizer`, `streamer`

**Query Parameters:**
- `createdBy` (string, optional): Filter by creator ID

**Response:**
```json
{
  "totalHighlights": 100,
  "totalViews": 50000,
  "totalLikes": 2500,
  "totalShares": 500,
  "avgDuration": 8,
  "publishedHighlights": 80,
  "pendingHighlights": 15,
  "rejectedHighlights": 5
}
```

## CDN Uploads API

### Create Upload

**POST** `/cdn-uploads`

Creates a new CDN upload for a recording or highlight.

**Required Roles:** `admin`, `organizer`, `streamer`

**Request Body:**
```json
{
  "recordingId": "uuid",
  "highlightId": "uuid",
  "uploadedBy": "uuid",
  "type": "video|thumbnail|preview|metadata",
  "provider": "aws_s3|gcp_cloud|azure_blob|custom",
  "originalFileName": "string",
  "fileName": "string",
  "filePath": "string",
  "bucket": "string",
  "region": "string",
  "metadata": {
    "mimeType": "string",
    "size": 1048576,
    "checksum": "string",
    "encoding": "string",
    "lastModified": "ISO 8601 datetime"
  },
  "storageMetadata": {
    "storageClass": "string",
    "encryption": "string",
    "backupEnabled": true,
    "retentionPeriod": 30,
    "accessControl": "string"
  },
  "uploadMetadata": {
    "uploadId": "string",
    "multipart": true,
    "partSize": 1048576,
    "totalParts": 10
  },
  "metadata": {
    "tags": ["string"],
    "language": "string",
    "featured": true,
    "priority": 1,
    "autoUploaded": true,
    "publicAccess": true,
    "allowedOrigins": ["string"],
    "maxDownloads": 1000,
    "downloadExpiry": "ISO 8601 datetime"
  },
  "region": "string"
}
```

**Response:**
```json
{
  "id": "uuid",
  "recordingId": "uuid",
  "highlightId": "uuid",
  "uploadedBy": "uuid",
  "status": "pending",
  "type": "video",
  "provider": "aws_s3",
  "originalFileName": "string",
  "fileName": "string",
  "filePath": "string",
  "bucket": "string",
  "region": "string",
  "cdnUrl": "string",
  "signedUrl": "string",
  "signedUrlExpiry": "ISO 8601 datetime",
  "thumbnailUrl": "string",
  "previewUrl": "string",
  "downloadUrl": "string",
  "embedUrl": "string",
  "fileMetadata": {},
  "uploadMetadata": {},
  "processingMetadata": {},
  "storageMetadata": {},
  "analytics": {},
  "metadata": {},
  "errorMessage": "string",
  "retryCount": 0,
  "lastRetryAt": "ISO 8601 datetime",
  "expiresAt": "ISO 8601 datetime",
  "archivedAt": "ISO 8601 datetime",
  "region": "global",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

### Start Upload

**POST** `/cdn-uploads/{id}/start`

Starts the upload process.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Upload ID

**Response:** Updated upload with `uploading` status

### Complete Upload

**POST** `/cdn-uploads/{id}/complete`

Marks upload as complete with CDN URLs.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Upload ID

**Request Body:**
```json
{
  "uploadId": "uuid",
  "cdnUrl": "string",
  "downloadUrl": "string",
  "embedUrl": "string",
  "thumbnailUrl": "string",
  "previewUrl": "string"
}
```

**Response:** Updated upload with `processing` status

### Finalize Upload

**POST** `/cdn-uploads/{id}/finalize`

Finalizes upload processing.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Upload ID

**Response:** Updated upload with `completed` status

### Generate Signed URL

**POST** `/cdn-uploads/{id}/signed-url`

Generates a signed URL for download access.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Path Parameters:**
- `id` (string, required): Upload ID

**Request Body:**
```json
{
  "uploadId": "uuid",
  "expiryMinutes": 60
}
```

**Response:**
```json
{
  "signedUrl": "string"
}
```

### Update Analytics

**POST** `/cdn-uploads/{id}/analytics`

Updates analytics data for an upload.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Upload ID

**Request Body:**
```json
{
  "uploadId": "uuid",
  "downloads": 100,
  "views": 500,
  "bandwidth": 1048576000,
  "avgDownloadSpeed": 1048576,
  "popularRegions": [
    {
      "region": "us-east-1",
      "requests": 250
    }
  ]
}
```

**Response:** Success message

### Get Uploads by Recording

**GET** `/cdn-uploads/recording/{recordingId}`

Retrieves all uploads for a specific recording.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Path Parameters:**
- `recordingId` (string, required): Recording ID

**Response:** Array of upload objects

### Get Uploads by Highlight

**GET** `/cdn-uploads/highlight/{highlightId}`

Retrieves all uploads for a specific highlight.

**Required Roles:** `admin`, `organizer`, `streamer`, `player`

**Path Parameters:**
- `highlightId` (string, required): Highlight ID

**Response:** Array of upload objects

### Get Upload Statistics

**GET** `/cdn-uploads/stats`

Retrieves upload statistics.

**Required Roles:** `admin`, `organizer`, `streamer`

**Query Parameters:**
- `uploadedBy` (string, optional): Filter by uploader ID

**Response:**
```json
{
  "totalUploads": 200,
  "totalSize": 10485760000,
  "completedUploads": 180,
  "failedUploads": 20,
  "totalBandwidth": 52428800000,
  "avgUploadSpeed": 2097152
}
```

## Stream Webhooks API

### Create Webhook

**POST** `/stream-webhooks`

Creates a new webhook for stream events.

**Required Roles:** `admin`, `organizer`, `streamer`

**Request Body:**
```json
{
  "streamSessionId": "uuid",
  "recordingId": "uuid",
  "highlightId": "uuid",
  "uploadId": "uuid",
  "type": "stream_start|stream_end|recording_start|recording_complete|highlight_ready|upload_complete",
  "provider": "custom|twitch|youtube|facebook|discord",
  "endpoint": "string",
  "event_id": "string",
  "payload": {},
  "headers": {},
  "signature": "string",
  "metadata": {
    "priority": 1,
    "timeout": 30,
    "retryStrategy": "linear|exponential|fixed",
    "webhookSecret": "string",
    "tags": ["string"]
  },
  "region": "string"
}
```

**Response:**
```json
{
  "id": "uuid",
  "streamSessionId": "uuid",
  "recordingId": "uuid",
  "highlightId": "uuid",
  "uploadId": "uuid",
  "type": "stream_start",
  "status": "pending",
  "provider": "custom",
  "endpoint": "string",
  "event_id": "string",
  "payload": {},
  "headers": {},
  "signature": "string",
  "response": {},
  "processingMetadata": {},
  "errorMessage": "string",
  "metadata": {},
  "deliveredAt": "ISO 8601 datetime",
  "expiresAt": "ISO 8601 datetime",
  "region": "global",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

### Deliver Webhook

**POST** `/stream-webhooks/{id}/deliver`

Manually delivers a webhook.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Webhook ID

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "response": {},
  "duration": 150
}
```

### Retry Webhook

**POST** `/stream-webhooks/{id}/retry`

Retries a failed webhook.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `id` (string, required): Webhook ID

**Response:** Delivery result object

### Get Webhooks by Stream

**GET** `/stream-webhooks/stream/{streamSessionId}`

Retrieves all webhooks for a specific stream session.

**Required Roles:** `admin`, `organizer`, `streamer`

**Path Parameters:**
- `streamSessionId` (string, required): Stream session ID

**Response:** Array of webhook objects

### Get Pending Webhooks

**GET** `/stream-webhooks/pending`

Retrieves all webhooks pending delivery.

**Required Roles:** `admin`, `organizer`, `streamer`

**Response:** Array of webhook objects with `pending` status

### Get Webhook Statistics

**GET** `/stream-webhooks/stats`

Retrieves webhook statistics.

**Required Roles:** `admin`, `organizer`, `streamer`

**Response:**
```json
{
  "totalWebhooks": 500,
  "completedWebhooks": 450,
  "failedWebhooks": 40,
  "pendingWebhooks": 10,
  "avgDeliveryTime": 200,
  "successRate": 90
}
```

## Error Responses

All endpoints may return error responses with the following format:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

### Common Error Codes

- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `CONFLICT` - Resource state conflict
- `INTERNAL_ERROR` - Server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Stream operations: 100 requests per minute
- Recording operations: 50 requests per minute
- Highlight operations: 200 requests per minute
- CDN operations: 1000 requests per minute
- Webhook operations: 500 requests per minute

## Webhooks

The Streaming Engine sends webhooks to notify external systems of events:

### Webhook Payload Format

```json
{
  "id": "uuid",
  "type": "stream_start",
  "provider": "custom",
  "event_id": "string",
  "timestamp": "ISO 8601 datetime",
  "payload": {
    "stream_session_id": "uuid",
    "status": "live",
    "title": "string"
  },
  "stream_session_id": "uuid"
}
```

### Webhook Headers

- `Content-Type: application/json`
- `User-Agent: RBX-Webhook-Service/1.0`
- `X-Webhook-ID: uuid`
- `X-Webhook-Type: string`
- `X-Webhook-Provider: string`
- `X-Webhook-Signature: sha256=signature` (if secret provided)

### Event Types

- `stream_start` - Stream has started
- `stream_end` - Stream has ended
- `recording_start` - Recording has started
- `recording_complete` - Recording processing complete
- `highlight_ready` - Highlight processing complete
- `upload_complete` - CDN upload complete

## SDK Examples

### JavaScript/TypeScript

```typescript
// Create stream session
const stream = await api.post('/streams', {
  streamerId: 'user-123',
  type: 'match',
  title: 'Tournament Finals',
  tournamentId: 'tournament-456',
});

// Start stream
await api.post(`/streams/${stream.data.id}/start`);

// Update viewer count
await api.post(`/streams/${stream.data.id}/viewer-count`, {
  viewerCount: 150,
});

// End stream
await api.post(`/streams/${stream.data.id}/end`, {
  reason: 'Match completed',
});
```

### Python

```python
import requests

# Create stream session
stream = requests.post('https://api.rbx.com/v1/streams', json={
    'streamerId': 'user-123',
    'type': 'match',
    'title': 'Tournament Finals',
    'tournamentId': 'tournament-456',
}, headers={'Authorization': 'Bearer token'})

# Start stream
requests.post(f"https://api.rbx.com/v1/streams/{stream.json()['id']}/start", 
               headers={'Authorization': 'Bearer token'})

# Update viewer count
requests.post(f"https://api.rbx.com/v1/streams/{stream.json()['id']}/viewer-count",
               json={'viewerCount': 150},
               headers={'Authorization': 'Bearer token'})
```

## Support

For API support and questions:
- Documentation: https://docs.rbx.com/streaming-api
- Support: support@rbx.com
- Status Page: https://status.rbx.com
