import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({
  tableName: 'unmatched_asset_imports',
  indexes: [
    { fields: ['sourceLocationNormalized'] },
    { fields: ['mappedLocationId'] },
  ],
})
export class UnmatchedAssetImport extends Model<UnmatchedAssetImport> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number

  @Column(DataType.INTEGER)
  declare sourceRowNumber?: number | null

  @Column(DataType.STRING)
  declare sourceLocation?: string | null

  @Column(DataType.STRING)
  declare sourceLocationNormalized?: string | null

  @Column(DataType.INTEGER)
  declare mappedLocationId?: number | null

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
