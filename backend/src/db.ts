import { Sequelize } from 'sequelize-typescript'
import { Location } from './models/Location'
import { WorkOrder } from './models/WorkOrder'
import { Asset } from './models/Asset'
import { PreventativeMaintenance } from './models/PreventativeMaintenance'
import { LocationNote } from './models/LocationNote'
import { PmCompletionHistory } from './models/PmCompletionHistory'
import { Contact } from './models/Contact'

const dbHost = process.env.DB_HOST || 'localhost'
const dbPort = Number(process.env.DB_PORT) || 3306
const dbName = process.env.DB_NAME || 'qualgen_wo'
const dbUser = process.env.DB_USER || 'root'
const dbPassword = process.env.DB_PASSWORD || ''

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
    Contact,
  ],
})

const defaultLocations = [
  'Enterprise',
  'Brisol',
  '100 Oaks',
  'Retail Pharamacy',
]

async function seedLocations() {
  for (const name of defaultLocations) {
    await Location.findOrCreate({ where: { name } })
  }
}

export async function initDb() {
  await sequelize.sync({ alter: true })
  await seedLocations()
}
