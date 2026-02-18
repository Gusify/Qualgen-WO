import { initialSchemaMigration } from './20260218_000001_initial_schema'
import type { Migration } from './types'

export const migrations: Migration[] = [initialSchemaMigration]
