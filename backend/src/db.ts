import { Sequelize } from 'sequelize-typescript'
import { Location } from './models/Location'
import { WorkOrder } from './models/WorkOrder'
import { Asset } from './models/Asset'
import { PreventativeMaintenance } from './models/PreventativeMaintenance'
import { LocationNote } from './models/LocationNote'
import { PmCompletionHistory } from './models/PmCompletionHistory'
import { CalibrationCompletionHistory } from './models/CalibrationCompletionHistory'
import { Contact } from './models/Contact'
import { UnmatchedAssetImport } from './models/UnmatchedAssetImport'

const dbHost = process.env.DB_HOST || 'localhost'
const dbPort = Number(process.env.DB_PORT) || 3306
const dbName = process.env.DB_NAME || 'qualgen_wo'
const dbUser = process.env.DB_USER || 'root'
const dbPassword = process.env.DB_PASSWORD || ''
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'

const parseBooleanEnv = (rawValue: string | undefined, defaultValue: boolean) => {
  if (rawValue === undefined) return defaultValue

  const normalized = rawValue.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

const dbSyncEnabled = parseBooleanEnv(process.env.DB_SYNC, true)
const dbSyncAlterEnabled = parseBooleanEnv(process.env.DB_SYNC_ALTER, !isProduction)

export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: dbHost,
  port: dbPort,
  database: dbName,
  username: dbUser,
  password: dbPassword,
  logging: false,
  models: [
    Location,
    WorkOrder,
    Asset,
    PreventativeMaintenance,
    LocationNote,
    PmCompletionHistory,
    CalibrationCompletionHistory,
    Contact,
    UnmatchedAssetImport,
  ],
})

const assertSchemaReady = async () => {
  try {
    await sequelize.getQueryInterface().describeTable('locations')
  } catch {
    throw new Error(
      'Database schema is missing. Run migrations before starting the API with DB_SYNC=false (npm run migrate).'
    )
  }
}

const defaultLocations = [
  'Enterprise',
  'Bristol',
  '100 Oaks',
  'Retail Pharamacy',
]

async function seedLocations() {
  for (const name of defaultLocations) {
    await Location.findOrCreate({ where: { name } })
  }
}

export async function initDb() {
  if (dbSyncEnabled) {
    if (dbSyncAlterEnabled) {
      await sequelize.sync({ alter: true })
    } else {
      await sequelize.sync()
    }
  } else {
    await sequelize.authenticate()
    await assertSchemaReady()
  }

  await seedLocations()
}
