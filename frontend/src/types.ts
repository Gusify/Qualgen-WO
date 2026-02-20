export interface Location {
  id: number
  name: string
}

export interface Contact {
  id: number
  company?: string | null
  contactName?: string | null
  department?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  locationName?: string | null
  address?: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ContactInput = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>

export interface WorkOrder {
  id: number
  locationId: number
  aid?: string | null
  manufacturerModel?: string | null
  equipmentDescription?: string | null
  location?: string | null
  activeRetired?: string | null
  owner?: string | null
  calDue?: string | null
  serialNumber?: string | null
  gmp?: string | null
  pmFreq?: string | null
  lastPm?: string | null
  pm?: string | null
  revalidationCertification?: string | null
  calFreq?: string | null
  lastCalibration?: string | null
  calibrationDueCompletedAt?: string | null
  calibrationRange?: string | null
  sop?: string | null
  notes?: string | null
  reviewerInitialDate?: string | null
  reconciledWithCrossList?: string | null
  createdAt?: string
  updatedAt?: string
}

export type WorkOrderInput = Omit<
  WorkOrder,
  'id' | 'locationId' | 'createdAt' | 'updatedAt'
>

export type Asset = WorkOrder

export type AssetInput = WorkOrderInput

export interface UnmatchedAssetImport extends AssetInput {
  id: number
  sourceRowNumber?: number | null
  sourceLocation?: string | null
  sourceLocationNormalized?: string | null
  mappedLocationId?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface CsvAssetImportResponse {
  importedCount: number
  unmatchedCount: number
  skippedCount: number
  errorCount: number
  errors: Array<{
    row: number
    reason: string
  }>
}

export interface PreventativeMaintenance {
  id: number
  locationId: number
  assetId?: number | null
  title?: string | null
  recurrence?: string | null
  scheduleAnchor?: string | null
  frequency?: string | null
  pmFreq?: string | null
  lastPm?: string | null
  pm?: string | null
  revalidationCertification?: string | null
  lastCompleted?: string | null
  nextDue?: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export type PreventativeMaintenanceInput = Omit<
  PreventativeMaintenance,
  'id' | 'locationId' | 'createdAt' | 'updatedAt'
>

export interface LocationNote {
  id: number
  locationId: number
  content: string
  createdAt?: string
  updatedAt?: string
}

export type LocationNoteInput = Omit<
  LocationNote,
  'id' | 'locationId' | 'createdAt' | 'updatedAt'
>

export interface PmCompletionHistory {
  id: number
  preventativeMaintenanceId: number
  locationId: number
  assetId?: number | null
  dueDate: string
  completedAt?: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PmCompletionHistoryInput {
  dueDate: string
  completedAt?: string | null
  notes?: string | null
}

export interface CalibrationCompletionHistory {
  id: number
  assetId: number
  locationId: number
  dueDate: string
  completedAt?: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CalibrationCompletionHistoryInput {
  dueDate: string
  completedAt?: string | null
  notes?: string | null
}

export interface PmComplianceReportRow {
  reportKey: string
  sourceType: 'pm' | 'calibration'
  sourceId: number
  preventativeMaintenanceId?: number | null
  title?: string | null
  recurrence?: string | null
  dueDate: string
  completedAt?: string | null
  status: 'completed-on-time' | 'completed-late' | 'missed' | 'scheduled'
  happened: boolean
  locationId: number
  locationName: string
  assetId?: number | null
  assetLabel: string
  notes?: string | null
}

export interface PmComplianceReportSummary {
  total: number
  completedOnTime: number
  completedLate: number
  missed: number
  scheduled: number
}

export interface PmComplianceReportResponse {
  range: {
    start: string
    end: string
    locationId: number | null
  }
  summary: PmComplianceReportSummary
  rows: PmComplianceReportRow[]
}

export interface MsGraphSyncResponse {
  range: {
    start: string
    end: string
    locationId: number | null
  }
  dryRun: boolean
  sourceEventCount: number
  managedEventCount: number
  deletedCount: number
  createdCount: number
}

export interface MsGraphStatusResponse {
  configured: boolean
  userId: string | null
  calendarId: string | null
}
