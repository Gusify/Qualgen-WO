import 'reflect-metadata'
import './loadEnv'
import { QueryTypes } from 'sequelize'
import { sequelize } from './db'
import { migrations } from './migrations'

const migrationTableName = 'schema_migrations'

const quoteIdentifier = (value: string) =>
  `\`${value.replace(/`/g, '``')}\``

const ensureMigrationsTable = async () => {
  const table = quoteIdentifier(migrationTableName)
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

const getAppliedMigrationNames = async () => {
  const table = quoteIdentifier(migrationTableName)
  const rows = await sequelize.query<{ name: string }>(
    `SELECT name FROM ${table}`,
    { type: QueryTypes.SELECT }
  )
  return new Set(rows.map((row) => row.name))
}

export const runMigrations = async () => {
  await sequelize.authenticate()
  await ensureMigrationsTable()

  const appliedNames = await getAppliedMigrationNames()
  const pending = migrations.filter((migration) => !appliedNames.has(migration.name))

  for (const migration of pending) {
    await sequelize.transaction(async (transaction) => {
      await migration.up({
        sequelize,
        queryInterface: sequelize.getQueryInterface(),
        transaction,
      })

      const table = quoteIdentifier(migrationTableName)
      await sequelize.query(
        `INSERT INTO ${table} (name, appliedAt) VALUES (:name, CURRENT_TIMESTAMP)`,
        {
          replacements: { name: migration.name },
          transaction,
        }
      )
    })
  }

  return {
    pendingCount: pending.length,
    appliedNames: pending.map((migration) => migration.name),
  }
}

const runMigrationsCli = async () => {
  try {
    const result = await runMigrations()
    if (result.pendingCount === 0) {
      // eslint-disable-next-line no-console
      console.log('No pending migrations.')
    } else {
      // eslint-disable-next-line no-console
      console.log(`Applied migrations: ${result.appliedNames.join(', ')}`)
    }
  } finally {
    await sequelize.close()
  }
}

if (require.main === module) {
  runMigrationsCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed', error)
    process.exit(1)
  })
}
