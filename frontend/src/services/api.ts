import type {
  Location,
  Asset,
  AssetInput,
  WorkOrder,
  WorkOrderInput,
  PreventativeMaintenance,
  PreventativeMaintenanceInput,
  LocationNote,
  LocationNoteInput,
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
  getLocations() {
    return request<Location[]>('/api/locations')
  },
  getAssets(locationId: number) {
    return request<Asset[]>(`/api/locations/${locationId}/assets`)
  },
  createAsset(locationId: number, payload: AssetInput) {
    return request<Asset>(`/api/locations/${locationId}/assets`, {
      method: 'POST',
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
