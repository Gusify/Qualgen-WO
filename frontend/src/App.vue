<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from './services/api'
import type {
  Location,
  WorkOrder,
  WorkOrderInput,
  PreventativeMaintenance,
  PreventativeMaintenanceInput,
  LocationNote,
  LocationNoteInput,
} from './types'

const loading = ref(true)
const errorMessage = ref('')
const locations = ref<Location[]>([])

const tabByLocation = reactive<Record<number, string>>({})
const workOrders = reactive<Record<number, WorkOrder[]>>({})
const preventatives = reactive<Record<number, PreventativeMaintenance[]>>({})
const notes = reactive<Record<number, LocationNote[]>>({})

const locationOrder = ['Enterprise', 'Brisol', '100 Oaks', 'Retail Pharamacy']

const sortedLocations = computed(() => {
  return [...locations.value].sort((a, b) => {
    const indexA = locationOrder.indexOf(a.name)
    const indexB = locationOrder.indexOf(b.name)
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
})

const workOrderFields = [
  { key: 'aid', label: 'AID' },
  { key: 'manufacturerModel', label: 'Manufacturer/Model' },
  { key: 'equipmentDescription', label: 'Equipment Description' },
  { key: 'location', label: 'Location' },
  { key: 'activeRetired', label: 'Active/Retired' },
  { key: 'owner', label: 'Owner' },
  { key: 'calDue', label: 'Cal Due' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'gmp', label: 'GMP' },
  { key: 'pmFreq', label: 'PM Freq' },
  { key: 'lastPm', label: 'Last PM' },
  { key: 'pm', label: 'PM' },
  { key: 'revalidationCertification', label: 'Revalidation/Certification?' },
  { key: 'calFreq', label: 'Cal Freq' },
  { key: 'lastCalibration', label: 'Last Calibration' },
  { key: 'calibrationRange', label: 'Calibration Range' },
  { key: 'sop', label: 'SOP' },
  { key: 'notes', label: 'Notes' },
  { key: 'reviewerInitialDate', label: 'Reviewer Initial/Date' },
  { key: 'reconciledWithCrossList', label: "Reconciled with Cross' List" },
] as const

const emptyWorkOrderDraft = (): WorkOrderInput => ({
  aid: '',
  manufacturerModel: '',
  equipmentDescription: '',
  location: '',
  activeRetired: '',
  owner: '',
  calDue: '',
  serialNumber: '',
  gmp: '',
  pmFreq: '',
  lastPm: '',
  pm: '',
  revalidationCertification: '',
  calFreq: '',
  lastCalibration: '',
  calibrationRange: '',
  sop: '',
  notes: '',
  reviewerInitialDate: '',
  reconciledWithCrossList: '',
})

const workOrderDialog = ref(false)
const workOrderSaving = ref(false)
const activeWorkOrderLocationId = ref<number | null>(null)
const workOrderDraft = reactive<WorkOrderInput>(emptyWorkOrderDraft())

const emptyPreventativeDraft = (): PreventativeMaintenanceInput => ({
  title: '',
  frequency: '',
  lastCompleted: '',
  nextDue: '',
  notes: '',
})

const preventativeDialog = ref(false)
const preventativeSaving = ref(false)
const activePreventativeLocationId = ref<number | null>(null)
const preventativeDraft = reactive<PreventativeMaintenanceInput>(
  emptyPreventativeDraft()
)

const emptyNoteDraft = (): LocationNoteInput => ({
  content: '',
})

const noteDialog = ref(false)
const noteSaving = ref(false)
const activeNoteLocationId = ref<number | null>(null)
const noteDraft = reactive<LocationNoteInput>(emptyNoteDraft())

const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
})

const setSnackbar = (message: string, color = 'success') => {
  snackbar.message = message
  snackbar.color = color
  snackbar.show = true
}

const formatValue = (value?: string | null) => {
  if (value === null || value === undefined) return '—'
  const trimmed = value.toString().trim()
  return trimmed.length === 0 ? '—' : trimmed
}

const formatDate = (value?: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

const workOrdersFor = (locationId: number) => workOrders[locationId] ?? []
const preventativesFor = (locationId: number) => preventatives[locationId] ?? []
const notesFor = (locationId: number) => notes[locationId] ?? []

const cleanPayload = <T extends Record<string, unknown>>(payload: T) => {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (typeof value === 'string') {
        const trimmed = value.trim()
        return [key, trimmed.length ? trimmed : null]
      }
      return [key, value]
    })
  ) as T
}

const loadLocationData = async (locationId: number) => {
  const [workOrderData, pmData, noteData] = await Promise.all([
    api.getWorkOrders(locationId),
    api.getPreventatives(locationId),
    api.getNotes(locationId),
  ])
  workOrders[locationId] = workOrderData
  preventatives[locationId] = pmData
  notes[locationId] = noteData
}

const refreshAll = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    locations.value = await api.getLocations()
    for (const location of locations.value) {
      tabByLocation[location.id] = tabByLocation[location.id] || 'work'
      await loadLocationData(location.id)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load'
    errorMessage.value = message
    setSnackbar(message, 'error')
  } finally {
    loading.value = false
  }
}

const openWorkOrderDialog = (locationId: number) => {
  activeWorkOrderLocationId.value = locationId
  Object.assign(workOrderDraft, emptyWorkOrderDraft())
  workOrderDialog.value = true
}

const openPreventativeDialog = (locationId: number) => {
  activePreventativeLocationId.value = locationId
  Object.assign(preventativeDraft, emptyPreventativeDraft())
  preventativeDialog.value = true
}

const openNoteDialog = (locationId: number) => {
  activeNoteLocationId.value = locationId
  Object.assign(noteDraft, emptyNoteDraft())
  noteDialog.value = true
}

const submitWorkOrder = async () => {
  if (!activeWorkOrderLocationId.value) return
  workOrderSaving.value = true
  try {
    const payload = cleanPayload({ ...workOrderDraft })
    const created = await api.createWorkOrder(
      activeWorkOrderLocationId.value,
      payload
    )
    workOrders[activeWorkOrderLocationId.value] = [
      created,
      ...workOrdersFor(activeWorkOrderLocationId.value),
    ]
    workOrderDialog.value = false
    setSnackbar('Work order saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save'
    setSnackbar(message, 'error')
  } finally {
    workOrderSaving.value = false
  }
}

const submitPreventative = async () => {
  if (!activePreventativeLocationId.value) return
  preventativeSaving.value = true
  try {
    const payload = cleanPayload({ ...preventativeDraft })
    const created = await api.createPreventative(
      activePreventativeLocationId.value,
      payload
    )
    preventatives[activePreventativeLocationId.value] = [
      created,
      ...preventativesFor(activePreventativeLocationId.value),
    ]
    preventativeDialog.value = false
    setSnackbar('Preventative maintenance saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save'
    setSnackbar(message, 'error')
  } finally {
    preventativeSaving.value = false
  }
}

const submitNote = async () => {
  if (!activeNoteLocationId.value) return
  const content = noteDraft.content.trim()
  if (!content) {
    setSnackbar('Note content is required', 'error')
    return
  }
  noteSaving.value = true
  try {
    const created = await api.createNote(activeNoteLocationId.value, { content })
    notes[activeNoteLocationId.value] = [
      created,
      ...notesFor(activeNoteLocationId.value),
    ]
    noteDialog.value = false
    setSnackbar('Note saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save'
    setSnackbar(message, 'error')
  } finally {
    noteSaving.value = false
  }
}

const removeWorkOrder = async (locationId: number, id: number) => {
  try {
    await api.deleteWorkOrder(id)
    workOrders[locationId] = workOrdersFor(locationId).filter(
      (item) => item.id !== id
    )
    setSnackbar('Work order deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete'
    setSnackbar(message, 'error')
  }
}

const removePreventative = async (locationId: number, id: number) => {
  try {
    await api.deletePreventative(id)
    preventatives[locationId] = preventativesFor(locationId).filter(
      (item) => item.id !== id
    )
    setSnackbar('Preventative maintenance deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete'
    setSnackbar(message, 'error')
  }
}

const removeNote = async (locationId: number, id: number) => {
  try {
    await api.deleteNote(id)
    notes[locationId] = notesFor(locationId).filter((item) => item.id !== id)
    setSnackbar('Note deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete'
    setSnackbar(message, 'error')
  }
}

onMounted(() => {
  refreshAll()
})
</script>

<template>
  <v-app>
    <div class="app-bg">
      <header class="top-bar">
        <div>
          <div class="eyebrow">Qualgen</div>
          <h1>Work Orders, PMs, and Notes</h1>
          <p class="subtitle">
            Four location lanes with dedicated tracking for equipment, PM cycles,
            and operational notes.
          </p>
        </div>
        <div class="top-actions">
          <v-btn variant="tonal" color="primary" @click="refreshAll">
            Refresh
          </v-btn>
          <v-chip v-if="loading" color="primary" variant="outlined">
            Loading
          </v-chip>
          <v-chip v-else color="success" variant="outlined"> Ready </v-chip>
        </div>
      </header>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div class="lane-grid">
        <div v-for="location in sortedLocations" :key="location.id">
          <v-card class="lane-card" elevation="8">
            <div class="lane-header">
              <div>
                <div class="lane-title">{{ location.name }}</div>
                <div class="lane-meta">
                  {{ workOrdersFor(location.id).length }} work orders ·
                  {{ preventativesFor(location.id).length }} PMs ·
                  {{ notesFor(location.id).length }} notes
                </div>
              </div>
              <div class="lane-actions">
                <v-btn
                  size="small"
                  color="primary"
                  variant="flat"
                  @click="openWorkOrderDialog(location.id)"
                >
                  Add Work Order
                </v-btn>
                <v-btn
                  size="small"
                  color="secondary"
                  variant="tonal"
                  @click="openPreventativeDialog(location.id)"
                >
                  Add PM
                </v-btn>
                <v-btn
                  size="small"
                  color="secondary"
                  variant="outlined"
                  @click="openNoteDialog(location.id)"
                >
                  Add Note
                </v-btn>
              </div>
            </div>

            <v-tabs
              v-model="tabByLocation[location.id]"
              color="primary"
              density="compact"
            >
              <v-tab value="work">Work Orders</v-tab>
              <v-tab value="pm">Preventative Maintenance</v-tab>
              <v-tab value="notes">Notes</v-tab>
            </v-tabs>

            <v-window v-model="tabByLocation[location.id]" class="lane-window">
              <v-window-item value="work">
                <div v-if="!workOrdersFor(location.id).length" class="empty">
                  No work orders yet. Add one to start tracking equipment.
                </div>
                <div v-else class="table-wrap">
                  <v-table density="compact" fixed-header height="360">
                    <thead>
                      <tr>
                        <th
                          v-for="header in workOrderFields"
                          :key="header.key"
                        >
                          {{ header.label }}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="item in workOrdersFor(location.id)"
                        :key="item.id"
                      >
                        <td
                          v-for="header in workOrderFields"
                          :key="header.key"
                        >
                          {{
                            formatValue(
                              item[header.key as keyof WorkOrder] as string | null
                            )
                          }}
                        </td>
                        <td>
                          <v-btn
                            icon="mdi-delete"
                            size="x-small"
                            variant="text"
                            @click="removeWorkOrder(location.id, item.id)"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </v-window-item>

              <v-window-item value="pm">
                <div v-if="!preventativesFor(location.id).length" class="empty">
                  No PM items yet. Log your first schedule.
                </div>
                <div v-else class="pm-list">
                  <v-card
                    v-for="item in preventativesFor(location.id)"
                    :key="item.id"
                    class="pm-card"
                    elevation="2"
                  >
                    <div class="pm-title">{{ item.title || 'Untitled PM' }}</div>
                    <div class="pm-meta">
                      <span>Frequency: {{ formatValue(item.frequency) }}</span>
                      <span>Last: {{ formatDate(item.lastCompleted) }}</span>
                      <span>Next Due: {{ formatDate(item.nextDue) }}</span>
                    </div>
                    <div class="pm-notes">
                      {{ formatValue(item.notes) }}
                    </div>
                    <div class="pm-actions">
                      <v-btn
                        icon="mdi-delete"
                        size="x-small"
                        variant="text"
                        @click="removePreventative(location.id, item.id)"
                      />
                    </div>
                  </v-card>
                </div>
              </v-window-item>

              <v-window-item value="notes">
                <div v-if="!notesFor(location.id).length" class="empty">
                  No notes yet. Add a quick log entry.
                </div>
                <div v-else class="notes-list">
                  <v-card
                    v-for="note in notesFor(location.id)"
                    :key="note.id"
                    class="note-card"
                    elevation="1"
                  >
                    <div class="note-body">{{ note.content }}</div>
                    <div class="note-footer">
                      <span class="note-date">
                        {{ formatDate(note.createdAt) }}
                      </span>
                      <v-btn
                        icon="mdi-delete"
                        size="x-small"
                        variant="text"
                        @click="removeNote(location.id, note.id)"
                      />
                    </div>
                  </v-card>
                </div>
              </v-window-item>
            </v-window>
          </v-card>
        </div>
      </div>
    </div>

    <v-dialog v-model="workOrderDialog" max-width="900">
      <v-card class="dialog-card">
        <v-card-title>New Work Order</v-card-title>
        <v-card-text>
          <div class="dialog-grid">
            <v-text-field
              v-for="field in workOrderFields"
              :key="field.key"
              v-model="workOrderDraft[field.key as keyof WorkOrderInput]"
              :label="field.label"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="workOrderDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="workOrderSaving"
            @click="submitWorkOrder"
          >
            Save Work Order
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="preventativeDialog" max-width="640">
      <v-card class="dialog-card">
        <v-card-title>New Preventative Maintenance</v-card-title>
        <v-card-text>
          <div class="dialog-grid small">
            <v-text-field
              v-model="preventativeDraft.title"
              label="Title"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="preventativeDraft.frequency"
              label="Frequency"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="preventativeDraft.lastCompleted"
              label="Last Completed"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="preventativeDraft.nextDue"
              label="Next Due"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-textarea
              v-model="preventativeDraft.notes"
              label="Notes"
              variant="outlined"
              density="comfortable"
              rows="3"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="preventativeDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="preventativeSaving"
            @click="submitPreventative"
          >
            Save PM
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="noteDialog" max-width="520">
      <v-card class="dialog-card">
        <v-card-title>New Note</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="noteDraft.content"
            label="Note"
            variant="outlined"
            density="comfortable"
            rows="4"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="noteDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="noteSaving"
            @click="submitNote"
          >
            Save Note
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-app>
</template>
