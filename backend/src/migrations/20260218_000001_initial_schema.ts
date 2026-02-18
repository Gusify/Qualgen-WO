import { DataTypes } from 'sequelize'
import type { Migration } from './types'

const timestampColumns = {
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
}

export const initialSchemaMigration: Migration = {
  name: '20260218_000001_initial_schema',
  up: async ({ queryInterface, transaction }) => {
    const tableExists = async (tableName: string) => {
      try {
        await queryInterface.describeTable(tableName)
        return true
      } catch {
        return false
      }
    }

    const createTableIfMissing = async (
      tableName: string,
      columns: Parameters<typeof queryInterface.createTable>[1]
    ) => {
      if (await tableExists(tableName)) return false
      await queryInterface.createTable(tableName, columns, { transaction })
      return true
    }

    await createTableIfMissing('locations', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      ...timestampColumns,
    })

    await createTableIfMissing('contacts', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      company: { type: DataTypes.STRING, allowNull: true },
      contactName: { type: DataTypes.STRING, allowNull: true },
      department: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      mobile: { type: DataTypes.STRING, allowNull: true },
      locationName: { type: DataTypes.STRING, allowNull: true },
      address: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...timestampColumns,
    })

    const workOrdersCreated = await createTableIfMissing('work_orders', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
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
      ...timestampColumns,
    })
    if (workOrdersCreated) {
      await queryInterface.addIndex('work_orders', ['locationId'], {
        name: 'work_orders_location_id_idx',
        transaction,
      })
    }

    const assetsCreated = await createTableIfMissing('assets', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
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
      ...timestampColumns,
    })
    if (assetsCreated) {
      await queryInterface.addIndex('assets', ['locationId'], {
        name: 'assets_location_id_idx',
        transaction,
      })
    }

    const pmsCreated = await createTableIfMissing('preventative_maintenances', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      assetId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'assets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      title: { type: DataTypes.STRING, allowNull: true },
      recurrence: { type: DataTypes.STRING, allowNull: true },
      scheduleAnchor: { type: DataTypes.STRING, allowNull: true },
      frequency: { type: DataTypes.STRING, allowNull: true },
      pmFreq: { type: DataTypes.STRING, allowNull: true },
      lastPm: { type: DataTypes.STRING, allowNull: true },
      pm: { type: DataTypes.STRING, allowNull: true },
      revalidationCertification: { type: DataTypes.STRING, allowNull: true },
      lastCompleted: { type: DataTypes.STRING, allowNull: true },
      nextDue: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...timestampColumns,
    })
    if (pmsCreated) {
      await queryInterface.addIndex('preventative_maintenances', ['locationId'], {
        name: 'preventative_maintenances_location_id_idx',
        transaction,
      })
      await queryInterface.addIndex('preventative_maintenances', ['assetId'], {
        name: 'preventative_maintenances_asset_id_idx',
        transaction,
      })
    }

    const locationNotesCreated = await createTableIfMissing('location_notes', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ...timestampColumns,
    })
    if (locationNotesCreated) {
      await queryInterface.addIndex('location_notes', ['locationId'], {
        name: 'location_notes_location_id_idx',
        transaction,
      })
    }

    const pmHistoryCreated = await createTableIfMissing('pm_completion_history', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      preventativeMaintenanceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'preventative_maintenances', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      assetId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'assets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      dueDate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      completedAt: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...timestampColumns,
    })
    if (pmHistoryCreated) {
      await queryInterface.addIndex(
        'pm_completion_history',
        ['preventativeMaintenanceId', 'dueDate'],
        {
          name: 'pm_completion_history_pm_due_unique',
          unique: true,
          transaction,
        }
      )
      await queryInterface.addIndex('pm_completion_history', ['locationId'], {
        name: 'pm_completion_history_location_id_idx',
        transaction,
      })
      await queryInterface.addIndex('pm_completion_history', ['assetId'], {
        name: 'pm_completion_history_asset_id_idx',
        transaction,
      })
    }

    const calibrationHistoryCreated = await createTableIfMissing(
      'calibration_completion_history',
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        assetId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'assets', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'NO ACTION',
        },
        locationId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'locations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'NO ACTION',
        },
        dueDate: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        completedAt: { type: DataTypes.STRING, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        ...timestampColumns,
      }
    )
    if (calibrationHistoryCreated) {
      await queryInterface.addIndex(
        'calibration_completion_history',
        ['assetId', 'dueDate'],
        {
          name: 'calibration_completion_history_asset_due_unique',
          unique: true,
          transaction,
        }
      )
      await queryInterface.addIndex('calibration_completion_history', ['locationId'], {
        name: 'calibration_completion_history_location_id_idx',
        transaction,
      })
    }
  },
  down: async ({ queryInterface, transaction }) => {
    await queryInterface.dropTable('calibration_completion_history', { transaction })
    await queryInterface.dropTable('pm_completion_history', { transaction })
    await queryInterface.dropTable('location_notes', { transaction })
    await queryInterface.dropTable('preventative_maintenances', { transaction })
    await queryInterface.dropTable('assets', { transaction })
    await queryInterface.dropTable('work_orders', { transaction })
    await queryInterface.dropTable('contacts', { transaction })
    await queryInterface.dropTable('locations', { transaction })
  },
}
