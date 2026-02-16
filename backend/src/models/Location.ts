import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
} from 'sequelize-typescript'
import { WorkOrder } from './WorkOrder'
import { Asset } from './Asset'
import { PreventativeMaintenance } from './PreventativeMaintenance'
import { LocationNote } from './LocationNote'

@Table({ tableName: 'locations' })
export class Location extends Model<Location> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare name: string

  @HasMany(() => WorkOrder)
  declare workOrders?: WorkOrder[]

  @HasMany(() => Asset)
  declare assets?: Asset[]

  @HasMany(() => PreventativeMaintenance)
  declare preventativeMaintenances?: PreventativeMaintenance[]

  @HasMany(() => LocationNote)
  declare notes?: LocationNote[]
}
