import { initialSchemaMigration } from './20260218_000001_initial_schema'
import { unmatchedAssetImportsMigration } from './20260220_000002_unmatched_asset_imports'
import { renameBrisolToBristolMigration } from './20260220_000003_rename_brisol_to_bristol'
import { consolidateBristolLocationMigration } from './20260220_000004_consolidate_bristol_location'
import type { Migration } from './types'

export const migrations: Migration[] = [
  initialSchemaMigration,
  unmatchedAssetImportsMigration,
  renameBrisolToBristolMigration,
  consolidateBristolLocationMigration,
]
