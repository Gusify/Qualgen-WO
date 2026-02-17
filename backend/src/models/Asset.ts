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
import { PmCompletionHistory } from './PmCompletionHistory'

@Table({ tableName: 'assets' })
export class Asset extends Model<Asset> {
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

  @HasMany(() => PmCompletionHistory)
  declare pmCompletionHistory?: PmCompletionHistory[]

  @Column(DataType.STRING)
  declare aid?: string | null

  @Column(DataType.STRING)
  declare manufacturerModel?: string | null

  @Column(DataType.STRING)
  declare equipmentDescription?: string | null

  @Column(DataType.STRING)
  declare location?: string | null

  @Column(DataType.STRING)
  declare activeRetired?: string | null

  @Column(DataType.STRING)
  declare owner?: string | null

  @Column(DataType.STRING)
  declare calDue?: string | null

  @Column(DataType.STRING)
  declare serialNumber?: string | null

  @Column(DataType.STRING)
  declare gmp?: string | null

  @Column(DataType.STRING)
  declare pmFreq?: string | null

  @Column(DataType.STRING)
  declare lastPm?: string | null

  @Column(DataType.STRING)
  declare pm?: string | null

  @Column(DataType.STRING)
  declare revalidationCertification?: string | null

  @Column(DataType.STRING)
  declare calFreq?: string | null

  @Column(DataType.STRING)
  declare lastCalibration?: string | null

  @Column(DataType.STRING)
  declare calibrationRange?: string | null

  @Column(DataType.STRING)
  declare sop?: string | null

  @Column(DataType.TEXT)
  declare notes?: string | null

  @Column(DataType.STRING)
  declare reviewerInitialDate?: string | null

  @Column(DataType.STRING)
  declare reconciledWithCrossList?: string | null
}
