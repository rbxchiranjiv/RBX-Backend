import globalConfig from 'config/globalConfig';

export function buildOpenApiDocument() {
  const bearerSecurity = [{ bearerAuth: [] as string[] }];

  return {
    openapi: '3.0.0',
    info: {
      title: `${globalConfig.metadata.appName} Service API`,
      version: globalConfig.metadata.version,
      description: 'Minimal OpenAPI document for RBx Stage 2d controllers.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths: {
      '/auth/login': {
        post: {
          summary: 'Login with phone number',
          responses: { 200: { description: 'Returns access/refresh tokens and user' } },
        },
      },
      '/auth/refresh': {
        post: {
          summary: 'Exchange refresh token for new tokens',
          responses: { 200: { description: 'Returns rotated tokens' }, 400: { description: 'Invalid refresh token' } },
        },
      },
      '/auth/logout': {
        post: {
          summary: 'Revoke refresh token',
          responses: { 200: { description: 'Refresh token revoked' } },
        },
      },
      '/users': {
        post: { summary: 'Create user', security: bearerSecurity, responses: { 201: { description: 'User created' }, 403: { description: 'Requires admin role' } } },
        get: { summary: 'List users', security: bearerSecurity, responses: { 200: { description: 'Users listed' } } },
      },
      '/users/{id}': {
        get: { summary: 'Get user', security: bearerSecurity, responses: { 200: { description: 'User fetched' } } },
        patch: { summary: 'Update user', security: bearerSecurity, responses: { 200: { description: 'User updated' } } },
      },
      '/teams': {
        post: { summary: 'Create team', security: bearerSecurity, responses: { 201: { description: 'Team created' } } },
        get: { summary: 'List teams', security: bearerSecurity, responses: { 200: { description: 'Teams listed' } } },
      },
      '/tournaments': {
        post: {
          summary: 'Create tournament (organizer/admin)',
          security: bearerSecurity,
          responses: { 201: { description: 'Tournament created' }, 403: { description: 'Requires organizer/admin' } },
        },
        get: { summary: 'List tournaments', responses: { 200: { description: 'Tournaments listed' } } },
      },
      '/registrations': {
        post: {
          summary: 'Create registration (team owner)',
          security: bearerSecurity,
          responses: { 201: { description: 'Registration created' }, 403: { description: 'Requires ownership' } },
        },
        get: {
          summary: 'List registrations (organizer/admin)',
          security: bearerSecurity,
          responses: { 200: { description: 'Registrations listed' } },
        },
      },
      '/matches/tournaments/{tournamentId}/schedule': {
        post: {
          summary: 'Schedule match (organizer/admin)',
          security: bearerSecurity,
          responses: { 201: { description: 'Match scheduled' } },
        },
      },
      '/payment-records': {
        post: {
          summary: 'Create payment record (admin)',
          security: bearerSecurity,
          responses: { 201: { description: 'Payment record created' } },
        },
        get: {
          summary: 'List payment records (self or admin)',
          security: bearerSecurity,
          responses: { 200: { description: 'Payment records listed' } },
        },
      },
      '/notifications/queue': {
        post: { summary: 'Queue notification (admin)', security: bearerSecurity, responses: { 201: { description: 'Notification queued' } } },
      },
      '/notifications': {
        get: { summary: 'List notifications (self/admin)', security: bearerSecurity, responses: { 200: { description: 'Notifications listed' } } },
      },
      // Payment endpoints
      '/payments/webhook/{gateway}': {
        post: {
          summary: 'Handle payment gateway webhook',
          description: 'Processes webhook events from payment gateways (Razorpay, Paytm, PayPal)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gateway: { type: 'string', enum: ['razorpay', 'paytm', 'paypal'] },
                    eventId: { type: 'string' },
                    payload: { type: 'object' },
                  },
                  required: ['gateway', 'eventId', 'payload'],
                },
              },
            },
          },
          responses: {
            200: { description: 'Webhook processed successfully' },
            400: { description: 'Invalid webhook signature or payload' },
          },
        },
      },
      '/payments/{tournamentId}/initiate': {
        post: {
          summary: 'Initiate payment for tournament',
          description: 'Creates a payment record and initiates payment gateway transaction',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string', default: 'USD' },
                    gateway: { type: 'string', enum: ['razorpay', 'paytm', 'paypal'] },
                    escrowHold: { type: 'boolean', default: true },
                    metadata: { type: 'object' },
                  },
                  required: ['amount'],
                },
              },
            },
          },
          responses: {
            201: { description: 'Payment initiated successfully' },
            403: { description: 'Requires organizer or admin role' },
          },
        },
      },
      '/payments/{paymentId}': {
        get: {
          summary: 'Get payment details',
          security: bearerSecurity,
          responses: {
            200: { description: 'Payment details retrieved' },
            403: { description: 'Can only view own payments' },
          },
        },
      },
      '/payments/tournament/{tournamentId}': {
        get: {
          summary: 'Get tournament payments',
          security: bearerSecurity,
          responses: {
            200: { description: 'Tournament payments retrieved' },
            403: { description: 'Requires organizer or admin role' },
          },
        },
      },
      '/payments/user/{userId}': {
        get: {
          summary: 'Get user payments',
          security: bearerSecurity,
          responses: {
            200: { description: 'User payments retrieved' },
            403: { description: 'Can only view own payments' },
          },
        },
      },
      // Escrow endpoints
      '/escrow/{organizerId}': {
        get: {
          summary: 'Get escrow balance',
          security: bearerSecurity,
          responses: {
            200: { description: 'Escrow balance retrieved' },
            403: { description: 'Can only view own escrow balance' },
          },
        },
      },
      '/escrow/{organizerId}/hold': {
        post: {
          summary: 'Hold escrow funds',
          description: 'Admin endpoint to hold funds in escrow',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amountCents: { type: 'number' },
                    reason: { type: 'string' },
                    relatedMatchId: { type: 'string' },
                  },
                  required: ['amountCents'],
                },
              },
            },
          },
          responses: {
            201: { description: 'Funds held successfully' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/escrow/{organizerId}/release': {
        post: {
          summary: 'Release escrow funds',
          description: 'Admin endpoint to release held funds in escrow',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amountCents: { type: 'number' },
                    reason: { type: 'string' },
                    relatedMatchId: { type: 'string' },
                  },
                  required: ['amountCents'],
                },
              },
            },
          },
          responses: {
            201: { description: 'Funds released successfully' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      // Admin payout endpoints
      '/admin/payouts/create': {
        post: {
          summary: 'Create payout batch',
          description: 'Admin endpoint to create a new payout batch',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    organizerId: { type: 'string' },
                    amountCents: { type: 'number' },
                    currency: { type: 'string', default: 'USD' },
                    destinationInfo: {
                      type: 'object',
                      properties: {
                        accountIdentifier: { type: 'string' },
                        gateway: { type: 'string' },
                      },
                      required: ['accountIdentifier'],
                    },
                  },
                  required: ['organizerId', 'amountCents', 'destinationInfo'],
                },
              },
            },
          },
          responses: {
            201: { description: 'Payout batch created' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts/{batchId}/process': {
        post: {
          summary: 'Process payout batch',
          description: 'Admin endpoint to process a pending payout batch',
          security: bearerSecurity,
          responses: {
            200: { description: 'Payout batch processed' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts/{batchId}/retry': {
        post: {
          summary: 'Retry failed transactions',
          description: 'Admin endpoint to retry failed transactions in a batch',
          security: bearerSecurity,
          responses: {
            200: { description: 'Failed transactions retried' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts/{batchId}': {
        get: {
          summary: 'Get payout batch details',
          security: bearerSecurity,
          responses: {
            200: { description: 'Payout batch details retrieved' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts': {
        get: {
          summary: 'List payout batches',
          security: bearerSecurity,
          parameters: [
            { name: 'organizerId', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'processing', 'sent', 'failed'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            200: { description: 'Payout batches listed' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts/{batchId}/transactions': {
        get: {
          summary: 'Get payout batch transactions',
          security: bearerSecurity,
          responses: {
            200: { description: 'Payout transactions retrieved' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts/transactions/{transactionId}': {
        patch: {
          summary: 'Update payout transaction',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['pending', 'processing', 'sent', 'failed'] },
                    failureReason: { type: 'string' },
                    gatewayReference: { type: 'string' },
                    metadata: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Payout transaction updated' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/webhook-events': {
        get: {
          summary: 'List webhook events',
          security: bearerSecurity,
          parameters: [
            { name: 'gateway', in: 'query', schema: { type: 'string' } },
            { name: 'processed', in: 'query', schema: { type: 'boolean' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: { description: 'Webhook events listed' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/webhook-events/{eventId}': {
        get: {
          summary: 'Get webhook event details',
          security: bearerSecurity,
          responses: {
            200: { description: 'Webhook event details retrieved' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/webhook-events/{eventId}/retry': {
        post: {
          summary: 'Retry failed webhook event',
          security: bearerSecurity,
          responses: {
            200: { description: 'Webhook event retried' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/escrow-summary': {
        get: {
          summary: 'Get escrow summary',
          description: 'Admin endpoint to get overall escrow statistics',
          security: bearerSecurity,
          responses: {
            200: { description: 'Escrow summary retrieved' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      '/admin/payouts/summary': {
        get: {
          summary: 'Get payout summary',
          description: 'Admin endpoint to get overall payout statistics',
          security: bearerSecurity,
          responses: {
            200: { description: 'Payout summary retrieved' },
            403: { description: 'Requires admin role' },
          },
        },
      },
      // Leaderboard endpoints
      '/leaderboard/global': {
        get: {
          summary: 'Get global leaderboard',
          description: 'Retrieve the global leaderboard across all seasons and regions',
          parameters: [
            { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['global', 'season', 'tournament'] } },
            { name: 'category', in: 'query', required: true, schema: { type: 'string', enum: ['teams', 'players'] } },
            { name: 'seasonId', in: 'query', schema: { type: 'string' } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'points' } },
            { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          ],
          responses: {
            200: { description: 'Global leaderboard retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/season/{seasonId}': {
        get: {
          summary: 'Get season leaderboard',
          description: 'Retrieve the leaderboard for a specific season',
          parameters: [
            { name: 'seasonId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['global', 'season', 'tournament'] } },
            { name: 'category', in: 'query', required: true, schema: { type: 'string', enum: ['teams', 'players'] } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'points' } },
            { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          ],
          responses: {
            200: { description: 'Season leaderboard retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/tournament/{tournamentId}': {
        get: {
          summary: 'Get tournament leaderboard',
          description: 'Retrieve the leaderboard for a specific tournament',
          parameters: [
            { name: 'tournamentId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['global', 'season', 'tournament'] } },
            { name: 'category', in: 'query', required: true, schema: { type: 'string', enum: ['teams', 'players'] } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'points' } },
            { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          ],
          responses: {
            200: { description: 'Tournament leaderboard retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/refresh': {
        post: {
          summary: 'Refresh leaderboard',
          description: 'Force refresh of the specified leaderboard (Admin/Organizer only)',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['type', 'category'],
                  properties: {
                    type: { type: 'string', enum: ['global', 'season', 'tournament'] },
                    category: { type: 'string', enum: ['teams', 'players'] },
                    seasonId: { type: 'string' },
                    tournamentId: { type: 'string' },
                    region: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Leaderboard refreshed successfully' },
            400: { description: 'Invalid parameters' },
            403: { description: 'Forbidden - insufficient permissions' },
          },
        },
      },
      '/leaderboard/standings/{tournamentId}': {
        get: {
          summary: 'Get tournament standings',
          description: 'Retrieve detailed standings for a specific tournament',
          parameters: [
            { name: 'tournamentId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            200: { description: 'Tournament standings retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/season-stats/{participantId}': {
        get: {
          summary: 'Get season statistics for participant',
          description: 'Retrieve detailed season statistics for a team or player',
          parameters: [
            { name: 'participantId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['team', 'player'] } },
            { name: 'seasonId', in: 'query', schema: { type: 'string' } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Season statistics retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/top-season-stats': {
        get: {
          summary: 'Get top season statistics',
          description: 'Retrieve top performers for a specific season',
          parameters: [
            { name: 'seasonId', in: 'query', schema: { type: 'string' } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['team', 'player'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          ],
          responses: {
            200: { description: 'Top season statistics retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/organizer/stats': {
        get: {
          summary: 'Get organizer statistics',
          description: 'Retrieve performance statistics for the authenticated organizer',
          security: bearerSecurity,
          parameters: [
            { name: 'seasonId', in: 'query', schema: { type: 'string' } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Organizer statistics retrieved successfully' },
            400: { description: 'Invalid parameters' },
            403: { description: 'Forbidden - insufficient permissions' },
          },
        },
      },
      '/leaderboard/history/{participantId}': {
        get: {
          summary: 'Get participant season history',
          description: 'Retrieve historical season statistics for a team or player',
          parameters: [
            { name: 'participantId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['team', 'player'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          ],
          responses: {
            200: { description: 'Season history retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
      '/leaderboard/season/{seasonId}/summary': {
        get: {
          summary: 'Get season summary',
          description: 'Retrieve comprehensive summary statistics for a season',
          parameters: [
            { name: 'seasonId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'region', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Season summary retrieved successfully' },
            400: { description: 'Invalid parameters' },
          },
        },
      },
    },
  };
}
