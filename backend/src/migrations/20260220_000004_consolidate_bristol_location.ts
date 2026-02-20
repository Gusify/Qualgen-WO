import { QueryTypes } from 'sequelize'
import type { Migration } from './types'

const canonicalName = 'Bristol'
const typoName = 'Brisol'

export const consolidateBristolLocationMigration: Migration = {
  name: '20260220_000004_consolidate_bristol_location',
  up: async ({ queryInterface, transaction }) => {
    const locationRows = await queryInterface.sequelize.query<{ id: number; name: string }>(
      `
        SELECT id, name
        FROM locations
        WHERE LOWER(name) IN (LOWER(:canonicalName), LOWER(:typoName))
        ORDER BY
          CASE WHEN LOWER(name) = LOWER(:canonicalName) THEN 0 ELSE 1 END,
          id ASC
      `,
      {
        replacements: { canonicalName, typoName },
        type: QueryTypes.SELECT,
        transaction,
      }
    )

    if (!locationRows.length) return

    const canonicalCandidate = locationRows.find(
      (row) => row.name.toLowerCase() === canonicalName.toLowerCase()
    )
    const canonicalId = canonicalCandidate?.id ?? locationRows[0].id

    await queryInterface.sequelize.query(
      `UPDATE locations SET name = :canonicalName WHERE id = :canonicalId`,
      {
        replacements: { canonicalName, canonicalId },
        transaction,
      }
    )

    const obsoleteIds = locationRows
      .map((row) => row.id)
      .filter((id) => id !== canonicalId)

    if (obsoleteIds.length) {
      const tablesWithLocationId = [
        'work_orders',
        'assets',
        'preventative_maintenances',
        'location_notes',
        'pm_completion_history',
        'calibration_completion_history',
      ]

      for (const table of tablesWithLocationId) {
        await queryInterface.sequelize.query(
          `UPDATE ${table} SET locationId = :canonicalId WHERE locationId IN (:obsoleteIds)`,
          {
            replacements: { canonicalId, obsoleteIds },
            transaction,
          }
        )
      }

      await queryInterface.sequelize.query(
        `
          UPDATE unmatched_asset_imports
          SET mappedLocationId = :canonicalId
          WHERE mappedLocationId IN (:obsoleteIds)
        `,
        {
          replacements: { canonicalId, obsoleteIds },
          transaction,
        }
      )

      await queryInterface.sequelize.query(
        `DELETE FROM locations WHERE id IN (:obsoleteIds)`,
        {
          replacements: { obsoleteIds },
          transaction,
        }
      )
    }

    await queryInterface.sequelize.query(
      `UPDATE assets SET location = :canonicalName WHERE LOWER(location) = LOWER(:typoName)`,
      {
        replacements: { canonicalName, typoName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `UPDATE work_orders SET location = :canonicalName WHERE LOWER(location) = LOWER(:typoName)`,
      {
        replacements: { canonicalName, typoName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE contacts
        SET locationName = :canonicalName
        WHERE LOWER(locationName) = LOWER(:typoName)
      `,
      {
        replacements: { canonicalName, typoName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE unmatched_asset_imports
        SET sourceLocation = :canonicalName
        WHERE LOWER(sourceLocation) = LOWER(:typoName)
      `,
      {
        replacements: { canonicalName, typoName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE unmatched_asset_imports
        SET location = :canonicalName
        WHERE LOWER(location) = LOWER(:typoName)
      `,
      {
        replacements: { canonicalName, typoName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE unmatched_asset_imports
        SET sourceLocationNormalized = 'bristol'
        WHERE LOWER(sourceLocationNormalized) = 'brisol'
      `,
      { transaction }
    )
  },
}

