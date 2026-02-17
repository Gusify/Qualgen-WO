import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({ tableName: 'contacts' })
export class Contact extends Model<Contact> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number

  @Column(DataType.STRING)
  declare company?: string | null

  @Column(DataType.STRING)
  declare contactName?: string | null

  @Column(DataType.STRING)
  declare department?: string | null

  @Column(DataType.STRING)
  declare email?: string | null

  @Column(DataType.STRING)
  declare phone?: string | null

  @Column(DataType.STRING)
  declare mobile?: string | null

  @Column(DataType.STRING)
  declare locationName?: string | null

  @Column(DataType.STRING)
  declare address?: string | null

  @Column(DataType.TEXT)
  declare notes?: string | null
}
