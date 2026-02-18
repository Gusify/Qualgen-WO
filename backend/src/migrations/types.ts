import type { QueryInterface, Sequelize, Transaction } from 'sequelize'

export interface MigrationContext {
  sequelize: Sequelize
  queryInterface: QueryInterface
  transaction: Transaction
}

export interface Migration {
  name: string
  up: (context: MigrationContext) => Promise<void>
  down?: (context: MigrationContext) => Promise<void>
}
