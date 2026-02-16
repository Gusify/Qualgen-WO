import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript'
import { Location } from './Location'
import { Asset } from './Asset'
import { PmCompletionHistory } from './PmCompletionHistory'

@Table({ tableName: 'preventative_maintenances' })
export class PreventativeMaintenance extends Model<PreventativeMaintenance> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number

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

  @Column(DataType.STRING)
  declare title?: string | null

  @Column(DataType.STRING)
  declare recurrence?: string | null

  @Column(DataType.STRING)
  declare scheduleAnchor?: string | null

  @Column(DataType.STRING)
  declare frequency?: string | null

  @Column(DataType.STRING)
  declare pmFreq?: string | null

  @Column(DataType.STRING)
  declare lastPm?: string | null

  @Column(DataType.STRING)
  declare pm?: string | null

  @Column(DataType.STRING)
  declare revalidationCertification?: string | null

  @Column(DataType.STRING)
  declare lastCompleted?: string | null

  @Column(DataType.STRING)
  declare nextDue?: string | null

  @Column(DataType.TEXT)
  declare notes?: string | null

  @HasMany(() => PmCompletionHistory)
  declare completionHistory?: PmCompletionHistory[]
}
