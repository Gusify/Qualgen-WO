import { QueryTypes } from 'sequelize'
import type { Migration } from './types'

const legacyName = 'Brisol'
const canonicalName = 'Bristol'

export const renameBrisolToBristolMigration: Migration = {
  name: '20260220_000003_rename_brisol_to_bristol',
  up: async ({ queryInterface, transaction }) => {
    const findLocationId = async (name: string) => {
      const rows = await queryInterface.sequelize.query<{ id: number }>(
        `
          SELECT id
          FROM locations
          WHERE LOWER(name) = LOWER(:name)
          ORDER BY id ASC
          LIMIT 1
        `,
        {
          replacements: { name },
          type: QueryTypes.SELECT,
          transaction,
        }
      )
      return rows[0]?.id ?? null
    }

    const brisolId = await findLocationId(legacyName)
    const bristolId = await findLocationId(canonicalName)

    if (brisolId && !bristolId) {
      await queryInterface.sequelize.query(
        `UPDATE locations SET name = :canonicalName WHERE id = :brisolId`,
        {
          replacements: { canonicalName, brisolId },
          transaction,
        }
      )
    } else if (brisolId && bristolId && brisolId !== bristolId) {
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
          `UPDATE ${table} SET locationId = :bristolId WHERE locationId = :brisolId`,
          {
            replacements: { bristolId, brisolId },
            transaction,
          }
        )
      }

      await queryInterface.sequelize.query(
        `
          UPDATE unmatched_asset_imports
          SET mappedLocationId = :bristolId
          WHERE mappedLocationId = :brisolId
        `,
        {
          replacements: { bristolId, brisolId },
          transaction,
        }
      )

      await queryInterface.sequelize.query(`DELETE FROM locations WHERE id = :brisolId`, {
        replacements: { brisolId },
        transaction,
      })
    }

    await queryInterface.sequelize.query(
      `UPDATE assets SET location = :canonicalName WHERE LOWER(location) = LOWER(:legacyName)`,
      {
        replacements: { canonicalName, legacyName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `UPDATE work_orders SET location = :canonicalName WHERE LOWER(location) = LOWER(:legacyName)`,
      {
        replacements: { canonicalName, legacyName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE contacts
        SET locationName = :canonicalName
        WHERE LOWER(locationName) = LOWER(:legacyName)
      `,
      {
        replacements: { canonicalName, legacyName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE unmatched_asset_imports
        SET sourceLocation = :canonicalName
        WHERE LOWER(sourceLocation) = LOWER(:legacyName)
      `,
      {
        replacements: { canonicalName, legacyName },
        transaction,
      }
    )
    await queryInterface.sequelize.query(
      `
        UPDATE unmatched_asset_imports
        SET location = :canonicalName
        WHERE LOWER(location) = LOWER(:legacyName)
      `,
      {
        replacements: { canonicalName, legacyName },
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

