import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript'
import { Location } from './Location'

@Table({ tableName: 'location_notes' })
export class LocationNote extends Model<LocationNote> {
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

  @Column({ type: DataType.TEXT, allowNull: false })
  declare content: string
}
