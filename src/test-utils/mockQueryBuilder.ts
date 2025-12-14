/**
 * Creates a mock QueryBuilder for testing TypeORM queries
 */
export function createMockQueryBuilder() {
  const mockBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    rightJoin: jest.fn().mockReturnThis(),
    rightJoinAndSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
    getOneOrFail: jest.fn(),
    getCount: jest.fn(),
    execute: jest.fn(),
    stream: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    getRawAndEntities: jest.fn(),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    cache: jest.fn().mockReturnThis(),
    lock: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    orWhereInIds: jest.fn().mockReturnThis(),
  };

  return mockBuilder;
}

/**
 * Creates a mock QueryBuilder with specific return values
 */
export function createMockQueryBuilderWithOverrides(overrides: Partial<ReturnType<typeof createMockQueryBuilder>>) {
  const mockBuilder = createMockQueryBuilder();
  return { ...mockBuilder, ...overrides };
}
