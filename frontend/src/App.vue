<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from './services/api'
import type {
  Location,
  Asset,
  AssetInput,
  PreventativeMaintenance,
  PreventativeMaintenanceInput,
  LocationNote,
  LocationNoteInput,
} from './types'

const loading = ref(true)
const errorMessage = ref('')
const locations = ref<Location[]>([])

type ViewMode = 'locations' | 'global-calendar'
const viewMode = ref<ViewMode>('locations')

const tabByLocation = reactive<Record<number, string>>({})
const assets = reactive<Record<number, Asset[]>>({})
const preventatives = reactive<Record<number, PreventativeMaintenance[]>>({})
const notes = reactive<Record<number, LocationNote[]>>({})
const calendarMonthByLocation = reactive<Record<number, string>>({})

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

const assetFields = [
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

const preventativeRecurrenceOptions = [
  { title: 'Weekly', value: 'weekly' },
  { title: 'Bi Weekly', value: 'bi-weekly' },
  { title: 'Monthly', value: 'monthly' },
  { title: 'Bi Monthly', value: 'bi-monthly' },
  { title: 'Quarterly', value: 'quarterly' },
  { title: 'Every 6 Months', value: 'every-6-months' },
  { title: 'Yearly', value: 'yearly' },
  { title: 'Bi Yearly', value: 'bi-yearly' },
] as const

type RecurrenceValue =
  (typeof preventativeRecurrenceOptions)[number]['value']

const recurrenceValues = preventativeRecurrenceOptions.map(
  (option) => option.value
) as RecurrenceValue[]

const recurrenceLabels = Object.fromEntries(
  preventativeRecurrenceOptions.map((option) => [option.value, option.title])
) as Record<RecurrenceValue, string>

const defaultCalendarMonth = (() => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
})()

const globalCalendarMonth = ref(defaultCalendarMonth)
const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pageTitle = computed(() =>
  viewMode.value === 'locations' ? 'Assets, PMs, and Notes' : 'PM Master Calendar'
)

const pageSubtitle = computed(() =>
  viewMode.value === 'locations'
    ? 'Four location lanes with dedicated tracking for equipment, PM cycles, and operational notes.'
    : 'Full recurring preventive maintenance calendar across every location.'
)

const emptyAssetDraft = (): AssetInput => ({
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

const assetDialog = ref(false)
const assetSaving = ref(false)
const activeAssetLocationId = ref<number | null>(null)
const assetDraft = reactive<AssetInput>(emptyAssetDraft())

const emptyPreventativeDraft = (): PreventativeMaintenanceInput => ({
  assetId: null,
  title: '',
  recurrence: 'monthly',
  frequency: 'monthly',
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

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseIsoDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const addMonths = (date: Date, months: number) => {
  const next = new Date(date)
  const dayOfMonth = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(dayOfMonth, maxDay))
  return next
}

const asRecurrenceValue = (value?: string | null): RecurrenceValue | null => {
  if (!value) return null
  return recurrenceValues.includes(value as RecurrenceValue)
    ? (value as RecurrenceValue)
    : null
}

const recurrenceLabel = (value?: string | null) => {
  const normalized = asRecurrenceValue(value)
  return normalized ? recurrenceLabels[normalized] : '—'
}

const nextRecurringDate = (date: Date, recurrence: RecurrenceValue) => {
  if (recurrence === 'weekly') return addDays(date, 7)
  if (recurrence === 'bi-weekly') return addDays(date, 14)
  if (recurrence === 'monthly') return addMonths(date, 1)
  if (recurrence === 'bi-monthly') return addMonths(date, 2)
  if (recurrence === 'quarterly') return addMonths(date, 3)
  if (recurrence === 'every-6-months') return addMonths(date, 6)
  if (recurrence === 'yearly') return addMonths(date, 12)
  return addMonths(date, 24)
}

const assetsFor = (locationId: number) => assets[locationId] ?? []
const preventativesFor = (locationId: number) => preventatives[locationId] ?? []
const notesFor = (locationId: number) => notes[locationId] ?? []

const assetDisplayLabel = (asset: Asset) => {
  const parts = [asset.aid, asset.manufacturerModel, asset.equipmentDescription]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)

  return parts.length ? parts.join(' · ') : `Asset #${asset.id}`
}

const assetNameFor = (locationId: number, assetId?: number | null) => {
  if (!assetId) return 'Unassigned Asset'
  const matched = assetsFor(locationId).find((asset) => asset.id === assetId)
  return matched ? assetDisplayLabel(matched) : `Asset #${assetId}`
}

const preventativeTitleFor = (
  locationId: number,
  item: PreventativeMaintenance
) => {
  const title = item.title?.trim()
  return title && title.length ? title : assetNameFor(locationId, item.assetId)
}

const preventativeAssetOptions = computed(() => {
  if (!activePreventativeLocationId.value) return []
  return assetsFor(activePreventativeLocationId.value).map((asset) => ({
    title: assetDisplayLabel(asset),
    value: asset.id,
  }))
})

interface CalendarEvent {
  key: string
  date: string
  title: string
  assetLabel: string
  recurrenceLabel: string
}

interface CalendarDayGroup {
  date: string
  items: CalendarEvent[]
}

interface GlobalCalendarEvent extends CalendarEvent {
  locationId: number
  locationName: string
}

interface GlobalCalendarCell {
  date: string | null
  dayLabel: string
  items: GlobalCalendarEvent[]
}

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

const getMonthBounds = (month: string) => {
  const [yearRaw, monthRaw] = month.split('-').map((part) => Number(part))
  const fallbackYear = Number(defaultCalendarMonth.slice(0, 4))
  const fallbackMonth = Number(defaultCalendarMonth.slice(5, 7))
  const year = Number.isFinite(yearRaw ?? NaN) ? Number(yearRaw) : fallbackYear
  const monthNumber = Number.isFinite(monthRaw ?? NaN)
    ? Number(monthRaw)
    : fallbackMonth

  const start = new Date(year, monthNumber - 1, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(year, monthNumber, 0)
  end.setHours(23, 59, 59, 999)

  return { start, end, year, monthNumber, daysInMonth: end.getDate() }
}

const buildLocationEventsBetween = (
  locationId: number,
  startBoundary: Date,
  endBoundary: Date
) => {
  const events: CalendarEvent[] = []

  for (const item of preventativesFor(locationId)) {
    const recurrence = asRecurrenceValue(item.recurrence ?? item.frequency)
    const firstDate = parseIsoDate(item.nextDue)

    if (!recurrence || !firstDate) continue

    let occurrence = new Date(firstDate)
    let safety = 0

    while (occurrence < startBoundary && safety < 500) {
      occurrence = nextRecurringDate(occurrence, recurrence)
      safety += 1
    }

    while (occurrence <= endBoundary && safety < 600) {
      events.push({
        key: `${locationId}-${item.id}-${toIsoDate(occurrence)}-${safety}`,
        date: toIsoDate(occurrence),
        title: preventativeTitleFor(locationId, item),
        assetLabel: assetNameFor(locationId, item.assetId),
        recurrenceLabel: recurrenceLabels[recurrence],
      })
      occurrence = nextRecurringDate(occurrence, recurrence)
      safety += 1
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

const calendarEventsForMonth = (locationId: number) => {
  const month = calendarMonthByLocation[locationId] || defaultCalendarMonth
  const { start, end } = getMonthBounds(month)

  return buildLocationEventsBetween(locationId, start, end).reduce<CalendarDayGroup[]>(
    (groups, event) => {
      const last = groups[groups.length - 1]
      if (!last || last.date !== event.date) {
        groups.push({ date: event.date, items: [event] })
      } else {
        last.items.push(event)
      }
      return groups
    },
    []
  )
}

const calendarCountForMonth = (locationId: number) => {
  return calendarEventsForMonth(locationId).reduce(
    (count, group) => count + group.items.length,
    0
  )
}

const globalCalendarEventsForMonth = computed(() => {
  const { start, end } = getMonthBounds(globalCalendarMonth.value)
  const events: GlobalCalendarEvent[] = []

  for (const location of sortedLocations.value) {
    const locationEvents = buildLocationEventsBetween(location.id, start, end)
    for (const event of locationEvents) {
      events.push({
        ...event,
        locationId: location.id,
        locationName: location.name,
      })
    }
  }

  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.locationName.localeCompare(b.locationName) ||
      a.title.localeCompare(b.title)
  )
})

const globalCalendarTotal = computed(() => globalCalendarEventsForMonth.value.length)

const globalCalendarMonthLabel = computed(() => {
  const { start } = getMonthBounds(globalCalendarMonth.value)
  return start.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
})

const globalCalendarEventsByDate = computed(() => {
  const grouped: Record<string, GlobalCalendarEvent[]> = {}
  for (const event of globalCalendarEventsForMonth.value) {
    const bucket = grouped[event.date] ?? []
    bucket.push(event)
    grouped[event.date] = bucket
  }
  return grouped
})

const globalCalendarCells = computed(() => {
  const { year, monthNumber, daysInMonth, start } = getMonthBounds(globalCalendarMonth.value)
  const cells: GlobalCalendarCell[] = []
  const firstWeekday = start.getDay()

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({
      date: null,
      dayLabel: '',
      items: [],
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDate = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      date: isoDate,
      dayLabel: String(day),
      items: globalCalendarEventsByDate.value[isoDate] ?? [],
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      date: null,
      dayLabel: '',
      items: [],
    })
  }

  return cells
})

const shiftGlobalCalendarMonth = (offset: number) => {
  const { start } = getMonthBounds(globalCalendarMonth.value)
  const next = addMonths(start, offset)
  globalCalendarMonth.value = `${next.getFullYear()}-${String(
    next.getMonth() + 1
  ).padStart(2, '0')}`
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'locations' ? 'global-calendar' : 'locations'
}

const loadLocationData = async (locationId: number) => {
  const [assetData, pmData, noteData] = await Promise.all([
    api.getAssets(locationId),
    api.getPreventatives(locationId),
    api.getNotes(locationId),
  ])
  assets[locationId] = assetData
  preventatives[locationId] = pmData
  notes[locationId] = noteData
}

const refreshAll = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    locations.value = await api.getLocations()
    for (const location of locations.value) {
      tabByLocation[location.id] = tabByLocation[location.id] || 'assets'
      calendarMonthByLocation[location.id] =
        calendarMonthByLocation[location.id] || defaultCalendarMonth
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

const openAssetDialog = (locationId: number) => {
  activeAssetLocationId.value = locationId
  Object.assign(assetDraft, emptyAssetDraft())
  assetDialog.value = true
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

const submitAsset = async () => {
  if (!activeAssetLocationId.value) return
  assetSaving.value = true
  try {
    const payload = cleanPayload({ ...assetDraft })
    const created = await api.createAsset(activeAssetLocationId.value, payload)
    assets[activeAssetLocationId.value] = [
      created,
      ...assetsFor(activeAssetLocationId.value),
    ]
    assetDialog.value = false
    setSnackbar('Asset saved to library')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save'
    setSnackbar(message, 'error')
  } finally {
    assetSaving.value = false
  }
}

const submitPreventative = async () => {
  if (!activePreventativeLocationId.value) return

  if (!preventativeDraft.assetId) {
    setSnackbar('Select an asset for this PM', 'error')
    return
  }

  const recurrence = asRecurrenceValue(preventativeDraft.recurrence)
  if (!recurrence) {
    setSnackbar('Select a recurrence', 'error')
    return
  }

  const nextDue = (preventativeDraft.nextDue ?? '').toString().trim()
  if (!nextDue) {
    setSnackbar('First due date is required', 'error')
    return
  }

  preventativeSaving.value = true
  try {
    const payload = cleanPayload({
      ...preventativeDraft,
      recurrence,
      frequency: recurrence,
      nextDue,
    })
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

const removeAsset = async (locationId: number, id: number) => {
  try {
    await api.deleteAsset(id)
    assets[locationId] = assetsFor(locationId).filter((item) => item.id !== id)
    setSnackbar('Asset deleted from library')
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
          <h1>{{ pageTitle }}</h1>
          <p class="subtitle">
            {{ pageSubtitle }}
          </p>
        </div>
        <div class="top-actions">
          <v-btn
            color="primary"
            variant="flat"
            @click="toggleViewMode"
          >
            {{ viewMode === 'locations' ? 'Full PM Calendar' : 'Location Boards' }}
          </v-btn>
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

      <div v-if="viewMode === 'locations'" class="lane-grid">
        <div v-for="location in sortedLocations" :key="location.id">
          <v-card class="lane-card" elevation="8">
            <div class="lane-header">
              <div>
                <div class="lane-title">{{ location.name }}</div>
                <div class="lane-meta">
                  {{ assetsFor(location.id).length }} assets ·
                  {{ preventativesFor(location.id).length }} PMs ·
                  {{ notesFor(location.id).length }} notes
                </div>
              </div>
              <div class="lane-actions">
                <v-btn
                  size="small"
                  color="primary"
                  variant="flat"
                  @click="openAssetDialog(location.id)"
                >
                  Add Asset
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
              <v-tab value="assets">Assets</v-tab>
              <v-tab value="pm">Preventative Maintenance</v-tab>
              <v-tab value="calendar">Calendar</v-tab>
              <v-tab value="notes">Notes</v-tab>
            </v-tabs>

            <v-window v-model="tabByLocation[location.id]" class="lane-window">
              <v-window-item value="assets">
                <div v-if="!assetsFor(location.id).length" class="empty">
                  No assets yet. Add one to start tracking equipment.
                </div>
                <div v-else class="table-wrap">
                  <v-table density="compact" fixed-header height="360">
                    <thead>
                      <tr>
                        <th v-for="header in assetFields" :key="header.key">
                          {{ header.label }}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in assetsFor(location.id)" :key="item.id">
                        <td v-for="header in assetFields" :key="header.key">
                          {{
                            formatValue(
                              item[header.key as keyof Asset] as string | null
                            )
                          }}
                        </td>
                        <td>
                          <v-btn
                            icon="mdi-delete"
                            size="x-small"
                            variant="text"
                            @click="removeAsset(location.id, item.id)"
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
                    <div class="pm-title">
                      {{ preventativeTitleFor(location.id, item) }}
                    </div>
                    <div class="pm-meta">
                      <span>Asset: {{ assetNameFor(location.id, item.assetId) }}</span>
                      <span>
                        Recurrence:
                        {{ recurrenceLabel(item.recurrence ?? item.frequency) }}
                      </span>
                      <span>Last: {{ formatDate(item.lastCompleted) }}</span>
                      <span>First/Next Due: {{ formatDate(item.nextDue) }}</span>
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

              <v-window-item value="calendar">
                <div class="calendar-toolbar">
                  <v-text-field
                    v-model="calendarMonthByLocation[location.id]"
                    type="month"
                    label="Calendar Month"
                    density="comfortable"
                    variant="outlined"
                    hide-details
                    class="calendar-month-input"
                  />
                  <v-chip color="primary" variant="tonal" size="small">
                    {{ calendarCountForMonth(location.id) }} scheduled
                  </v-chip>
                </div>

                <div
                  v-if="!calendarEventsForMonth(location.id).length"
                  class="empty"
                >
                  No PM dates scheduled for this month. Add PMs with recurrence to
                  populate the calendar.
                </div>

                <div v-else class="calendar-list">
                  <v-card
                    v-for="group in calendarEventsForMonth(location.id)"
                    :key="group.date"
                    class="calendar-day-card"
                    elevation="1"
                  >
                    <div class="calendar-day-header">
                      <div class="calendar-day-date">{{ formatDate(group.date) }}</div>
                      <v-chip size="x-small" color="secondary" variant="outlined">
                        {{ group.items.length }} items
                      </v-chip>
                    </div>
                    <div class="calendar-events">
                      <div
                        v-for="event in group.items"
                        :key="event.key"
                        class="calendar-event-row"
                      >
                        <div class="calendar-event-title">{{ event.title }}</div>
                        <div class="calendar-event-meta">
                          {{ event.assetLabel }} · {{ event.recurrenceLabel }}
                        </div>
                      </div>
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

      <div v-else class="global-calendar-page">
        <v-card class="global-calendar-card" elevation="8">
          <div class="global-calendar-header">
            <div>
              <div class="global-calendar-title">{{ globalCalendarMonthLabel }}</div>
              <div class="lane-meta">All scheduled PM occurrences across locations</div>
            </div>
            <div class="global-calendar-controls">
              <div class="calendar-nav-arrows">
                <v-btn
                  icon="mdi-chevron-left"
                  size="small"
                  variant="tonal"
                  @click="shiftGlobalCalendarMonth(-1)"
                />
                <v-btn
                  icon="mdi-chevron-right"
                  size="small"
                  variant="tonal"
                  @click="shiftGlobalCalendarMonth(1)"
                />
              </div>
              <v-text-field
                v-model="globalCalendarMonth"
                type="month"
                label="Month"
                density="comfortable"
                variant="outlined"
                hide-details
                class="calendar-month-input"
              />
              <v-chip color="primary" variant="tonal" size="small">
                {{ globalCalendarTotal }} scheduled
              </v-chip>
            </div>
          </div>

          <div class="global-calendar-weekdays">
            <div
              v-for="weekday in weekdayHeaders"
              :key="weekday"
              class="global-calendar-weekday"
            >
              {{ weekday }}
            </div>
          </div>

          <div class="global-calendar-grid">
            <div
              v-for="(cell, index) in globalCalendarCells"
              :key="cell.date ?? `blank-${index}`"
              class="global-calendar-cell"
              :class="{ 'is-empty': !cell.date }"
            >
              <template v-if="cell.date">
                <div class="global-calendar-day">{{ cell.dayLabel }}</div>
                <div v-if="cell.items.length" class="global-calendar-cell-events">
                  <div
                    v-for="event in cell.items"
                    :key="event.key"
                    class="global-calendar-item"
                  >
                    <div class="global-calendar-item-title">{{ event.title }}</div>
                    <div class="global-calendar-item-meta">
                      {{ event.locationName }} · {{ event.assetLabel }}
                    </div>
                    <div class="global-calendar-item-meta">
                      {{ event.recurrenceLabel }}
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div v-if="!globalCalendarTotal" class="empty global-calendar-empty">
            No PM dates scheduled for this month.
          </div>
        </v-card>
      </div>
    </div>

    <v-dialog v-model="assetDialog" max-width="900">
      <v-card class="dialog-card">
        <v-card-title>Add Asset</v-card-title>
        <v-card-text>
          <div class="dialog-grid">
            <v-text-field
              v-for="field in assetFields"
              :key="field.key"
              v-model="assetDraft[field.key as keyof AssetInput]"
              :label="field.label"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="assetDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="assetSaving"
            @click="submitAsset"
          >
            Save Asset
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="preventativeDialog" max-width="640">
      <v-card class="dialog-card">
        <v-card-title>New Preventative Maintenance</v-card-title>
        <v-card-text>
          <div class="dialog-grid small">
            <v-select
              v-model="preventativeDraft.assetId"
              label="Asset"
              :items="preventativeAssetOptions"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              hide-details
              :disabled="!preventativeAssetOptions.length"
            />
            <v-select
              v-model="preventativeDraft.recurrence"
              label="Recurrence"
              :items="preventativeRecurrenceOptions"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="preventativeDraft.title"
              label="PM Title (Optional)"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="preventativeDraft.nextDue"
              label="First Due Date"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="preventativeDraft.lastCompleted"
              label="Last Completed"
              type="date"
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
          <div
            v-if="!preventativeAssetOptions.length"
            class="pm-dialog-hint"
          >
            Add at least one asset for this site before creating a PM schedule.
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
