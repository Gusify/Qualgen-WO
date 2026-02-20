import { DataTypes } from 'sequelize'
import type { Migration } from './types'

const tableName = 'unmatched_asset_imports'

export const unmatchedAssetImportsMigration: Migration = {
  name: '20260220_000002_unmatched_asset_imports',
  up: async ({ queryInterface, transaction }) => {
    try {
      await queryInterface.describeTable(tableName)
      return
    } catch {
      // Continue: table does not exist yet.
    }

    await queryInterface.createTable(
      tableName,
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        sourceRowNumber: { type: DataTypes.INTEGER, allowNull: true },
        sourceLocation: { type: DataTypes.STRING, allowNull: true },
        sourceLocationNormalized: { type: DataTypes.STRING, allowNull: true },
        mappedLocationId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'locations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        aid: { type: DataTypes.STRING, allowNull: true },
        manufacturerModel: { type: DataTypes.STRING, allowNull: true },
        equipmentDescription: { type: DataTypes.STRING, allowNull: true },
        location: { type: DataTypes.STRING, allowNull: true },
        activeRetired: { type: DataTypes.STRING, allowNull: true },
        owner: { type: DataTypes.STRING, allowNull: true },
        calDue: { type: DataTypes.STRING, allowNull: true },
        serialNumber: { type: DataTypes.STRING, allowNull: true },
        gmp: { type: DataTypes.STRING, allowNull: true },
        pmFreq: { type: DataTypes.STRING, allowNull: true },
        lastPm: { type: DataTypes.STRING, allowNull: true },
        pm: { type: DataTypes.STRING, allowNull: true },
        revalidationCertification: { type: DataTypes.STRING, allowNull: true },
        calFreq: { type: DataTypes.STRING, allowNull: true },
        lastCalibration: { type: DataTypes.STRING, allowNull: true },
        calibrationRange: { type: DataTypes.STRING, allowNull: true },
        sop: { type: DataTypes.STRING, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        reviewerInitialDate: { type: DataTypes.STRING, allowNull: true },
        reconciledWithCrossList: { type: DataTypes.STRING, allowNull: true },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      { transaction }
    )

    await queryInterface.addIndex(tableName, ['sourceLocationNormalized'], {
      name: 'unmatched_asset_imports_source_location_norm_idx',
      transaction,
    })
    await queryInterface.addIndex(tableName, ['mappedLocationId'], {
      name: 'unmatched_asset_imports_mapped_location_id_idx',
      transaction,
    })
  },
  down: async ({ queryInterface, transaction }) => {
    await queryInterface.dropTable(tableName, { transaction })
  },
}
