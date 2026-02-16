export interface Location {
  id: number
  name: string
}

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

export interface PreventativeMaintenance {
  id: number
  locationId: number
  title?: string | null
  frequency?: string | null
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
