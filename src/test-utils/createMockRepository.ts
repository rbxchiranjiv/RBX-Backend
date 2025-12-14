import { Repository, ObjectLiteral } from 'typeorm';

/**
 * Creates a mock repository with common methods for testing
 */
export function createMockRepository<T extends ObjectLiteral>(): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    count: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
    hasId: jest.fn(),
    getId: jest.fn(),
    preload: jest.fn(),
    merge: jest.fn(),
    clear: jest.fn(),
    target: {} as any,
    hasMetadata: jest.fn(),
    getMetadata: jest.fn(),
    manager: {} as any,
    queryRunner: {} as any,
    metadata: {} as any,
  } as any; // Use 'as any' to bypass strict typing issues
}

/**
 * Creates a mock repository with specific return values
 */
export function createMockRepositoryWithOverrides<T extends ObjectLiteral>(overrides: Partial<jest.Mocked<Repository<T>>>): jest.Mocked<Repository<T>> {
  const mock = createMockRepository<T>();
  return { ...mock, ...overrides } as any;
}
