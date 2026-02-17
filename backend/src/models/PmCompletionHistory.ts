import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript'
import { PreventativeMaintenance } from './PreventativeMaintenance'
import { Location } from './Location'
import { Asset } from './Asset'

@Table({
  tableName: 'pm_completion_history',
  indexes: [
    {
      unique: true,
      fields: ['preventativeMaintenanceId', 'dueDate'],
    },
  ],
})
export class PmCompletionHistory extends Model<PmCompletionHistory> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number

  @ForeignKey(() => PreventativeMaintenance)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare preventativeMaintenanceId: number

  @BelongsTo(() => PreventativeMaintenance)
  declare preventativeMaintenanceRef?: PreventativeMaintenance

  @ForeignKey(() => Location)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare locationId: number

  @BelongsTo(() => Location)
  declare locationRef?: Location

  @ForeignKey(() => Asset)
  @Column(DataType.INTEGER)
  declare assetId?: number | null

  @BelongsTo(() => Asset)
  declare assetRef?: Asset

  @Column({ type: DataType.STRING, allowNull: false })
  declare dueDate: string

  @Column(DataType.STRING)
  declare completedAt?: string | null

  @Column(DataType.TEXT)
  declare notes?: string | null
}
