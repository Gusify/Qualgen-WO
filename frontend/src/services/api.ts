import type {
  Contact,
  ContactInput,
  Location,
  Asset,
  AssetInput,
  WorkOrder,
  WorkOrderInput,
  PreventativeMaintenance,
  PreventativeMaintenanceInput,
  PmCompletionHistory,
  PmCompletionHistoryInput,
  CalibrationCompletionHistory,
  CalibrationCompletionHistoryInput,
  PmComplianceReportResponse,
  MsGraphSyncResponse,
  MsGraphStatusResponse,
  LocationNote,
  LocationNoteInput,
  UnmatchedAssetImport,
  CsvAssetImportResponse,
} from '../types'

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }

  return (await response.json()) as T
}

export const api = {
  getMsGraphStatus() {
    return request<MsGraphStatusResponse>('/api/integrations/ms-graph/status')
  },
  syncMsGraphCalendar(payload?: {
    start?: string
    end?: string
    locationId?: number
    dryRun?: boolean
  }) {
    return request<MsGraphSyncResponse>('/api/integrations/ms-graph/sync', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  },
  getContacts() {
    return request<Contact[]>('/api/contacts')
  },
  createContact(payload: ContactInput) {
    return request<Contact>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateContact(id: number, payload: Partial<ContactInput>) {
    return request<Contact>(`/api/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteContact(id: number) {
    return request<{ deleted: boolean }>(`/api/contacts/${id}`, {
      method: 'DELETE',
    })
  },
  getLocations() {
    return request<Location[]>('/api/locations')
  },
  getAssets(locationId: number) {
    return request<Asset[]>(`/api/locations/${locationId}/assets`)
  },
  importAssetsCsv(payload: { csvText: string }) {
    return request<CsvAssetImportResponse>('/api/assets/import-csv', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getUnmatchedAssets() {
    return request<UnmatchedAssetImport[]>('/api/assets/unmatched')
  },
  updateUnmatchedAsset(
    id: number,
    payload: Partial<Omit<UnmatchedAssetImport, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    return request<UnmatchedAssetImport>(`/api/assets/unmatched/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteUnmatchedAsset(id: number) {
    return request<{ deleted: boolean }>(`/api/assets/unmatched/${id}`, {
      method: 'DELETE',
    })
  },
  promoteUnmatchedAsset(id: number, payload?: { locationId?: number }) {
    return request<{ locationId: number; asset: Asset }>(
      `/api/assets/unmatched/${id}/promote`,
      {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      }
    )
  },
  createAsset(locationId: number, payload: AssetInput) {
    return request<Asset>(`/api/locations/${locationId}/assets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateAsset(id: number, payload: Partial<AssetInput>) {
    return request<Asset>(`/api/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteAsset(id: number) {
    return request<{ deleted: boolean }>(`/api/assets/${id}`, {
      method: 'DELETE',
    })
  },
  getWorkOrders(locationId: number) {
    return request<WorkOrder[]>(`/api/locations/${locationId}/workorders`)
  },
  createWorkOrder(locationId: number, payload: WorkOrderInput) {
    return request<WorkOrder>(`/api/locations/${locationId}/workorders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  deleteWorkOrder(id: number) {
    return request<{ deleted: boolean }>(`/api/workorders/${id}`, {
      method: 'DELETE',
    })
  },
  getPreventatives(locationId: number) {
    return request<PreventativeMaintenance[]>(
      `/api/locations/${locationId}/preventative-maintenances`
    )
  },
  createPreventative(locationId: number, payload: PreventativeMaintenanceInput) {
    return request<PreventativeMaintenance>(
      `/api/locations/${locationId}/preventative-maintenances`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
  },
  deletePreventative(id: number) {
    return request<{ deleted: boolean }>(
      `/api/preventative-maintenances/${id}`,
      { method: 'DELETE' }
    )
  },
  getPreventativeCompletionHistory(id: number) {
    return request<PmCompletionHistory[]>(
      `/api/preventative-maintenances/${id}/completion-history`
    )
  },
  createPreventativeCompletionHistory(
    id: number,
    payload: PmCompletionHistoryInput
  ) {
    return request<{
      history: PmCompletionHistory
      preventativeMaintenance: PreventativeMaintenance
    }>(`/api/preventative-maintenances/${id}/completion-history`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getCalibrationCompletionHistory(assetId: number) {
    return request<CalibrationCompletionHistory[]>(
      `/api/assets/${assetId}/calibration-history`
    )
  },
  createCalibrationCompletionHistory(
    assetId: number,
    payload: CalibrationCompletionHistoryInput
  ) {
    return request<{
      history: CalibrationCompletionHistory
      asset: Asset
    }>(`/api/assets/${assetId}/calibration-history`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getPmComplianceReport(params?: {
    start?: string
    end?: string
    locationId?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.start) searchParams.set('start', params.start)
    if (params?.end) searchParams.set('end', params.end)
    if (params?.locationId) searchParams.set('locationId', String(params.locationId))
    const query = searchParams.toString()
    return request<PmComplianceReportResponse>(
      `/api/reports/pm-compliance${query ? `?${query}` : ''}`
    )
  },
  getNotes(locationId: number) {
    return request<LocationNote[]>(`/api/locations/${locationId}/notes`)
  },
  createNote(locationId: number, payload: LocationNoteInput) {
    return request<LocationNote>(`/api/locations/${locationId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  deleteNote(id: number) {
    return request<{ deleted: boolean }>(`/api/notes/${id}`, {
      method: 'DELETE',
    })
  },
}
