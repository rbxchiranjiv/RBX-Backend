import { DataSource } from 'typeorm';

/**
 * Creates a mock transaction manager for testing
 */
export function createMockTransactionManager() {
  const mockTransactionManager = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockTransactionManager)),
    createQueryBuilder: jest.fn(),
    getRepository: jest.fn(),
    getTreeRepository: jest.fn(),
    getCustomRepository: jest.fn(),
    hasMetadata: jest.fn(),
    getMetadata: jest.fn(),
    entityMetadatas: [],
    manager: mockTransactionManager,
    driver: {} as any,
    options: {} as any,
    isInitialized: true,
    destroy: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
    query: jest.fn(),
    synchronize: jest.fn(),
    dropDatabase: jest.fn(),
    runMigrations: jest.fn(),
    undoLastMigration: jest.fn(),
    showMigrations: jest.fn(),
  } as any; // Use 'as any' to bypass complex type issues

  return {
    mockTransactionManager,
    mockDataSource,
  };
}

/**
 * Creates a simple transaction wrapper for services that expect transaction behavior
 */
export function createTransactionWrapper<T>(callback: (manager: any) => Promise<T>): Promise<T> {
  return callback(createMockTransactionManager().mockTransactionManager);
}
