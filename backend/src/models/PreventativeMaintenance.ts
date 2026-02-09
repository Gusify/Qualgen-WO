import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript'
import { Location } from './Location'

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

  @Column(DataType.STRING)
  declare title?: string | null

  @Column(DataType.STRING)
  declare frequency?: string | null

  @Column(DataType.STRING)
  declare lastCompleted?: string | null

  @Column(DataType.STRING)
  declare nextDue?: string | null

  @Column(DataType.TEXT)
  declare notes?: string | null
}
