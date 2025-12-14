import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpStatus } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WalletService } from '../services/wallet.service';
import { CreateWalletDto, WalletTransactionDto, WalletBalanceDto } from '../dto/wallet.dto';
import { TransactionType, ReferenceType } from '../database/entities/wallet-transaction.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { User } from '../decorators/user.decorator'; // TODO: Implement user decorator

// @ApiTags('wallets')
@Controller('api/wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  // @ApiOperation({ summary: 'Create a new wallet' })
  // @ApiResponse({ status: HttpStatus.CREATED, description: 'Wallet created successfully' })
  async createWallet(@Body() createWalletDto: CreateWalletDto /*, @User() user: any */) {
    // TODO: Implement user authentication
    const userId = 'temp-user-id'; // Temporary placeholder
    const wallet = await this.walletService.createWallet(userId, createWalletDto.currency);
    return { success: true, data: wallet };
  }

  @Get()
  // @ApiOperation({ summary: 'Get user wallets' })
  // @ApiResponse({ status: HttpStatus.OK, description: 'Wallets retrieved successfully' })
  async getWallets(/* @User() user: any, */ @Query('currency') currency?: string) {
    // TODO: Implement user authentication
    const userId = 'temp-user-id'; // Temporary placeholder
    const wallets = await this.walletService.getWalletByUser(userId, currency as any);
    return { success: true, data: wallets };
  }

  @Get(':walletId/balance')
  // @ApiOperation({ summary: 'Get wallet balance' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.OK, description: 'Balance retrieved successfully' })
  async getBalance(@Param('walletId') walletId: string) {
    const balance = await this.walletService.getWalletBalance(walletId);
    return { success: true, data: balance };
  }

  @Post(':walletId/transactions')
  // @ApiOperation({ summary: 'Create wallet transaction' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.CREATED, description: 'Transaction created successfully' })
  async createTransaction(
    @Param('walletId') walletId: string,
    @Body() transactionDto: WalletTransactionDto,
  ) {
    const transaction = await this.walletService.createTransaction(
      walletId,
      transactionDto.type,
      transactionDto.amount,
      transactionDto.description,
      transactionDto.referenceId,
      transactionDto.referenceType,
    );
    return { success: true, data: transaction };
  }

  @Get(':walletId/transactions')
  // @ApiOperation({ summary: 'Get wallet transaction history' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.OK, description: 'Transaction history retrieved successfully' })
  async getTransactionHistory(
    @Param('walletId') walletId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    const transactions = await this.walletService.getTransactionHistory(
      walletId,
      parseInt(limit.toString()),
      parseInt(offset.toString()),
    );
    return { success: true, data: transactions };
  }

  @Post(':walletId/topup')
  // @ApiOperation({ summary: 'Top up wallet' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.CREATED, description: 'Wallet topped up successfully' })
  async topUp(
    @Param('walletId') walletId: string,
    @Body() body: { amount: number; description?: string },
  ) {
    const transaction = await this.walletService.createTransaction(
      walletId,
      TransactionType.DEPOSIT,
      body.amount,
      body.description || 'Wallet top-up',
      undefined,
      undefined,
    );
    return { success: true, data: transaction };
  }

  @Post(':walletId/withdraw')
  // @ApiOperation({ summary: 'Withdraw from wallet' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.CREATED, description: 'Withdrawal request created' })
  async withdraw(
    @Param('walletId') walletId: string,
    @Body() body: { amount: number; description?: string },
  ) {
    const transaction = await this.walletService.createTransaction(
      walletId,
      TransactionType.WITHDRAWAL,
      body.amount,
      body.description || 'Wallet withdrawal',
      undefined,
      undefined,
    );
    return { success: true, data: transaction };
  }

  @Post(':walletId/transfer')
  // @ApiOperation({ summary: 'Transfer to another wallet' })
  // @ApiParam({ name: 'walletId', description: 'Source Wallet ID' })
  // @ApiResponse({ status: HttpStatus.CREATED, description: 'Transfer completed successfully' })
  async transfer(
    @Param('walletId') walletId: string,
    @Body() body: { targetWalletId: string; amount: number; description?: string },
  ) {
    // First withdraw from source
    const withdrawTx = await this.walletService.createTransaction(
      walletId,
      TransactionType.WITHDRAWAL,
      body.amount,
      body.description || 'Transfer out',
      undefined,
      ReferenceType.TRANSFER,
    );
    
    // Then deposit to target
    const depositTx = await this.walletService.createTransaction(
      body.targetWalletId,
      TransactionType.DEPOSIT,
      body.amount,
      body.description || 'Transfer in',
      withdrawTx.id,
      ReferenceType.TRANSFER,
    );
    
    return { success: true, data: { withdrawTx, depositTx } };
  }

  @Post(':walletId/escrow-hold')
  // @ApiOperation({ summary: 'Hold funds in escrow' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.CREATED, description: 'Escrow hold created' })
  async escrowHold(
    @Param('walletId') walletId: string,
    @Body() body: { amount: number; referenceId?: string; description?: string },
  ) {
    const escrowHold = await this.walletService.createEscrowHold(
      walletId,
      body.amount,
      body.referenceId,
      body.description || 'Escrow hold',
    );
    return { success: true, data: escrowHold };
  }

  @Post(':walletId/escrow-release')
  // @ApiOperation({ summary: 'Release funds from escrow' })
  // @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  // @ApiResponse({ status: HttpStatus.OK, description: 'Escrow released successfully' })
  async escrowRelease(
    @Param('walletId') walletId: string,
    @Body() body: { holdId: string; amount?: number; description?: string },
  ) {
    const release = await this.walletService.releaseEscrowHold(
      body.holdId,
      body.amount,
      body.description || 'Escrow release',
    );
    return { success: true, data: release };
  }
}
