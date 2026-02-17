import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript'
import { Asset } from './Asset'
import { Location } from './Location'

@Table({
  tableName: 'calibration_completion_history',
  indexes: [
    {
      unique: true,
      fields: ['assetId', 'dueDate'],
    },
  ],
})
export class CalibrationCompletionHistory extends Model<CalibrationCompletionHistory> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number

  @ForeignKey(() => Asset)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number

  @BelongsTo(() => Asset)
  declare assetRef?: Asset

  @ForeignKey(() => Location)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare locationId: number

  @BelongsTo(() => Location)
  declare locationRef?: Location

  @Column({ type: DataType.STRING, allowNull: false })
  declare dueDate: string

  @Column(DataType.STRING)
  declare completedAt?: string | null

  @Column(DataType.TEXT)
  declare notes?: string | null
}
