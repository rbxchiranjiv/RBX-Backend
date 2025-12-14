interface GlobalConfigSchema {
  metadata: {
    appName: string;
    organization: string;
    developerCredits: string;
    version: string;
    supportEmail: string;
    marketingSite: string;
  };
  featureFlags: {
    enableBRMode: boolean;
    enableCSMode: boolean;
    enableVersusMode: boolean;
    enableInvitedTeams: boolean;
    enableFreeTournamentCreationFees: boolean;
    enableKycGate: boolean;
    enableAutoRoomDistribution: boolean;
    enableDisputeReEntry: boolean;
    enablePaymentWebhooks: boolean;
  };
  organizer: {
    creationFees: {
      small: number;
      medium: number;
      large: number;
    };
    tournamentTypeChangeFee: number;
    defaultFreeReshuffles: number;
    extraReshuffleFee: number;
    maxTournamentsPerDay: number;
    cooldownHoursAfterBan: number;
    invitedSlotLimit: number;
    maxConcurrentDrafts: number;
    kycRequiredAboveAmount: number;
    fraudStrikeThreshold: number;
    manualApprovalRequired: boolean;
  };
  tournament: {
    platformCut: number;
    registrationWindowHours: number;
    refundWindowHours: number;
    defaultMatchDurationMinutes: number;
    defaultBufferMinutes: number;
    maxMatchesPerDay: number;
    autoRoomReminderMinutes: number;
    maxQualifierRounds: number;
    invitedTeamBypassRounds: boolean;
    minimumTeamSize: number;
    maximumTeamSize: number;
    br: {
      teamsPerMatch: number;
      reshuffleLimit: number;
      selectionStrategy: "random" | "seeded" | "balanced";
      allowManualOverrides: boolean;
    };
    cs: {
      concurrentMatches: number;
      matchDurationMinutes: number;
      defaultBestOf: number;
      forfeitGracePeriodMinutes: number;
    };
    refunds: {
      allowCreationFeeRefundBeforeRegistration: boolean;
      allowRegistrationRefundBeforeSchedule: boolean;
      maxRefundAttempts: number;
      gatewayFeeRefundable: boolean;
    };
    invitedSlots: {
      allowOrganizerInvites: boolean;
      maxInvitedTeamsPerTournament: number;
      inviteCodePrefix: string;
    };
    text: {
      registrationClosed: string;
      registrationSuccess: string;
      schedulePending: string;
      roomDetailsPending: string;
      organizerFeePending: string;
    };
  };
  versus: {
    platformCut: number;
    minimumStake: number;
    maximumStake: number;
    roomCodeTemplate: string;
    defaultMatchTimeoutMinutes: number;
    allowedModes: Array<"CS" | "BR">;
    allowAutoForfeitDetection: boolean;
    disputeWindowMinutes: number;
  };
  payments: {
    primaryGateway: "paytm" | "razorpay" | "paypal";
    backupGateway: "paytm" | "razorpay" | "paypal";
    payoutGateway: "razorpayx" | "paypal";
    sandboxMode: boolean;
    minimumBalanceForPayout: number;
    maximumPayoutPerDay: number;
    escrowHoldHours: number;
    settlementBufferHours: number;
    platformFeePercent: number;
    versusPlatformFeePercent: number;
    escrowEnabled: boolean;
    payoutMinAmountCents: number;
    gateways: {
      paytm: {
        enabled: boolean;
        testMode: boolean;
        merchantIdEnv: string;
        merchantKeyEnv: string;
        webhookSecretEnv: string;
      };
      razorpay: {
        enabled: boolean;
        testMode: boolean;
        webhookSecretEnv: string;
        apiKeyEnv: string;
        apiSecretEnv: string;
      };
      paypal: {
        enabled: boolean;
        testMode: boolean;
        webhookSecretEnv: string;
        clientIdEnv: string;
        clientSecretEnv: string;
      };
    };
    razorpayX: {
      apiKeyEnv: string;
      apiSecretEnv: string;
      accountNumberEnv: string;
    };
    refundPolicy: {
      allowManualReview: boolean;
      automaticApprovalBelowAmount: number;
      disputeResolutionTimeHours: number;
      notifyFinanceEmail: string;
    };
  };
  notifications: {
    morningReminderTime: string;
    thirtyMinReminderTime: string;
    fiveMinReminderTime: string;
    templates: {
      registrationClosed: string;
      matchSelected: string;
      matchScheduled: string;
      dayOfReminder: string;
      thirtyMinReminder: string;
      fiveMinReminder: string;
      matchStart: string;
      matchEnd: string;
      resultPublished: string;
      disputeUpdate: string;
      versusRoom: string;
      organizerFeePending: string;
    };
    pushChannels: string[];
    emailSender: string;
    smsSenderName: string;
  };
  scheduling: {
    lockTtlSeconds: number;
    defaultTimezone: string;
    autoScheduleRetries: number;
    autoScheduleRetryDelaySeconds: number;
    redisKeys: {
      tournamentLockPrefix: string;
      matchLockPrefix: string;
    };
    reshuffle: {
      requireReason: boolean;
      auditLogEnabled: boolean;
    };
    workers: {
      schedulerQueue: string;
      notificationQueue: string;
      paymentQueue: string;
    };
  };
  match: {
    disputeWindowMinutes: number;
    concurrencyLockStrategy: "db" | "redis";
  };
  limits: {
    maxTeamsPerTournament: number;
    maxPlayersPerTeam: number;
    minPlayersPerTeam: number;
    maxOrganizers: number;
    maxDisputesPerTeam: number;
    maxProofUploadsPerMatch: number;
    maxWaitlistSize: number;
    maxVersusPerDay: number;
  };
  security: {
    jwtExpiryMinutes: number;
    jwtRefreshDays: number;
    rateLimiterWindowSeconds: number;
    rateLimiterMaxRequests: number;
    ipReputationThreshold: number;
    maxFailedPaymentAttempts: number;
    webhookToleranceMinutes: number;
    enforceDeviceBinding: boolean;
    enableIpLogging: boolean;
  };
  textContent: {
    welcomeBanner: string;
    organizerInstructions: string;
    versusDisclaimer: string;
    disputeGuidelines: string;
    paymentInfo: string;
    maintenanceMessage: string;
  };
  storage: {
    mediaCdnBaseUrl: string;
    s3BucketEnv: string;
    proofRetentionDays: number;
    roomDetailTtlMinutes: number;
    cdnCacheSeconds: number;
  };
  support: {
    faqUrl: string;
    discordInvite: string;
    escalationEmail: string;
    officeHours: string;
  };
}

export type GlobalConfig = GlobalConfigSchema;
