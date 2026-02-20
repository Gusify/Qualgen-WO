<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { api } from './services/api'
import wideLogo from './assets/wide-logo.svg'
import type {
  Contact,
  ContactInput,
  Location,
  Asset,
  AssetInput,
  PreventativeMaintenance,
  PreventativeMaintenanceInput,
  PmComplianceReportRow,
  PmComplianceReportSummary,
  CalibrationCompletionHistory,
  LocationNote,
  LocationNoteInput,
  UnmatchedAssetImport,
} from './types'

const loading = ref(true)
const errorMessage = ref('')
const locations = ref<Location[]>([])
const contacts = ref<Contact[]>([])

type ViewMode = 'locations' | 'global-calendar' | 'imports' | 'contacts'
const viewMode = ref<ViewMode>('locations')

const tabByLocation = reactive<Record<number, string>>({})
const assets = reactive<Record<number, Asset[]>>({})
const preventatives = reactive<Record<number, PreventativeMaintenance[]>>({})
const notes = reactive<Record<number, LocationNote[]>>({})
const calendarMonthByLocation = reactive<Record<number, string>>({})
const unmatchedAssets = ref<UnmatchedAssetImport[]>([])

const locationOrder = ['Enterprise', 'Bristol', '100 Oaks', 'Retail Pharamacy']

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

const locationOptions = computed(() =>
  sortedLocations.value.map((location) => ({
    title: location.name,
    value: location.id,
  }))
)

const sortedUnmatchedAssets = computed(() => {
  const rows = [...unmatchedAssets.value]
  const sortBy = unmatchedSortBy.value
  return rows.sort((a, b) => {
    if (sortBy === 'updatedAt') {
      const aTime = new Date(a.updatedAt ?? 0).getTime()
      const bTime = new Date(b.updatedAt ?? 0).getTime()
      return bTime - aTime
    }
    const aValue = (a[sortBy] ?? '').toString().toLowerCase()
    const bValue = (b[sortBy] ?? '').toString().toLowerCase()
    return aValue.localeCompare(bValue)
  })
})

const assetTableFields = [
  { key: 'aid', label: 'Asset ID' },
  { key: 'manufacturerModel', label: 'Manufacturer/Model' },
  { key: 'equipmentDescription', label: 'Equipment Description' },
  { key: 'location', label: 'Location' },
  { key: 'owner', label: 'Owner' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'sop', label: 'SOP' },
  { key: 'notes', label: 'Notes' },
] as const

const assetDialogFields = [
  { key: 'aid', label: 'Asset ID' },
  { key: 'manufacturerModel', label: 'Manufacturer/Model' },
  { key: 'equipmentDescription', label: 'Equipment Description' },
  { key: 'location', label: 'Location' },
  { key: 'owner', label: 'Owner' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'revalidationCertification', label: 'Revalidation/Certification?' },
  { key: 'sop', label: 'SOP' },
  { key: 'notes', label: 'Notes' },
] as const

const contactTableFields = [
  { key: 'company', label: 'Company' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'department', label: 'Department' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Office Phone' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'locationName', label: 'Location' },
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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(
  /\/$/,
  ''
)

const globalCalendarIcsUrl = `${apiBaseUrl}/api/calendar.ics`
const locationCalendarIcsUrl = (locationId: number) =>
  `${apiBaseUrl}/api/locations/${locationId}/calendar.ics`

const globalCalendarMonth = ref(defaultCalendarMonth)
const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pageTitle = computed(() => {
  if (viewMode.value === 'locations') return 'Assets, PMs, and Notes'
  if (viewMode.value === 'global-calendar') return 'Calendar'
  if (viewMode.value === 'imports') return 'Import Library'
  return 'Business Contacts'
})

const pageSubtitle = computed(() => {
  if (viewMode.value === 'locations') {
    return 'Four location lanes with dedicated tracking for equipment, PM cycles, and operational notes.'
  }
  if (viewMode.value === 'global-calendar') {
    return 'Full recurring preventive maintenance and calibration calendar across every location.'
  }
  if (viewMode.value === 'imports') {
    return 'CSV staging area for imported assets with unknown locations. Edit, sort, and promote into location libraries.'
  }
  return 'Company-wide contact directory for vendors, service providers, and key partners.'
})

const emptyAssetDraft = (): AssetInput => ({
  aid: '',
  manufacturerModel: '',
  equipmentDescription: '',
  location: '',
  owner: '',
  serialNumber: '',
  gmp: '',
  revalidationCertification: '',
  sop: '',
  notes: '',
})

const assetDialog = ref(false)
const assetSaving = ref(false)
const activeAssetLocationId = ref<number | null>(null)
const activeAssetEditId = ref<number | null>(null)
const assetDraft = reactive<AssetInput>(emptyAssetDraft())
const assetGmpChecked = ref(false)

const assetDialogTitle = computed(() =>
  activeAssetEditId.value ? 'Edit Asset' : 'Add Asset'
)

const assetDialogSaveLabel = computed(() =>
  activeAssetEditId.value ? 'Save Changes' : 'Save Asset'
)

const emptyContactDraft = (): ContactInput => ({
  company: '',
  contactName: '',
  department: '',
  email: '',
  phone: '',
  mobile: '',
  locationName: '',
  address: '',
  notes: '',
})

const contactDialog = ref(false)
const contactSaving = ref(false)
const activeContactEditId = ref<number | null>(null)
const contactDraft = reactive<ContactInput>(emptyContactDraft())

const contactDialogTitle = computed(() =>
  activeContactEditId.value ? 'Edit Contact' : 'Add Contact'
)

const contactDialogSaveLabel = computed(() =>
  activeContactEditId.value ? 'Save Changes' : 'Save Contact'
)

const emptyCalibrationDraft = () => ({
  assetId: null as number | null,
  calDue: '',
  calFreq: '',
  calibrationRange: '',
  lastCalibration: '',
})

const calibrationDialog = ref(false)
const calibrationSaving = ref(false)
const activeCalibrationLocationId = ref<number | null>(null)
const calibrationDraft = reactive(emptyCalibrationDraft())

const emptyPreventativeDraft = (): PreventativeMaintenanceInput => ({
  assetId: null,
  title: '',
  recurrence: 'monthly',
  frequency: 'monthly',
  lastPm: '',
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

const completionDialog = ref(false)
const completionSaving = ref(false)
const activeCompletionLocationId = ref<number | null>(null)
const completionDraft = reactive({
  pmId: null as number | null,
  dueDate: '',
  completedAt: '',
  notes: '',
})

const calibrationHistoryDialog = ref(false)
const calibrationHistoryLoading = ref(false)
const calibrationHistorySaving = ref(false)
const activeCalibrationHistoryLocationId = ref<number | null>(null)
const activeCalibrationHistoryAssetId = ref<number | null>(null)
const calibrationHistoryRows = ref<CalibrationCompletionHistory[]>([])
const calibrationCompletionDraft = reactive({
  dueDate: '',
  completedAt: '',
  notes: '',
})

const emptyReportSummary = (): PmComplianceReportSummary => ({
  total: 0,
  completedOnTime: 0,
  completedLate: 0,
  missed: 0,
  scheduled: 0,
})

const pmReportLoading = ref(false)
const pmReportError = ref('')
const pmReportRows = ref<PmComplianceReportRow[]>([])
const pmReportSummary = reactive<PmComplianceReportSummary>(emptyReportSummary())
const msGraphConfigured = ref(false)
const msGraphSyncing = ref(false)

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

const csvImportDialog = ref(false)
const csvImporting = ref(false)
const csvImportText = ref('')
const csvImportFileName = ref('')

const unmatchedSortBy = ref<'updatedAt' | 'sourceLocation' | 'aid' | 'equipmentDescription'>(
  'updatedAt'
)
const unmatchedSortOptions = [
  { title: 'Last Updated', value: 'updatedAt' },
  { title: 'Source Location', value: 'sourceLocation' },
  { title: 'Asset ID', value: 'aid' },
  { title: 'Equipment Description', value: 'equipmentDescription' },
] as const

const unmatchedEditDialog = ref(false)
const unmatchedSaving = ref(false)
const activeUnmatchedEditId = ref<number | null>(null)
const unmatchedDraft = reactive({
  sourceLocation: '',
  mappedLocationId: null as number | null,
  aid: '',
  manufacturerModel: '',
  equipmentDescription: '',
  location: '',
  owner: '',
  serialNumber: '',
  revalidationCertification: '',
  sop: '',
  notes: '',
})

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

const todayIso = () => toIsoDate(new Date())

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

const recurrenceFromFrequencyText = (value?: string | null): RecurrenceValue | null => {
  if (!value) return null
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')

  const direct = asRecurrenceValue(normalized)
  if (direct) return direct

  const aliases: Record<string, RecurrenceValue> = {
    weekly: 'weekly',
    'every-week': 'weekly',
    biweekly: 'bi-weekly',
    'bi-weekly': 'bi-weekly',
    'every-2-weeks': 'bi-weekly',
    monthly: 'monthly',
    'every-month': 'monthly',
    bimonthly: 'bi-monthly',
    'bi-monthly': 'bi-monthly',
    'every-2-months': 'bi-monthly',
    quarterly: 'quarterly',
    'every-3-months': 'quarterly',
    'every-6-months': 'every-6-months',
    '6-months': 'every-6-months',
    semiannual: 'every-6-months',
    'semi-annual': 'every-6-months',
    yearly: 'yearly',
    annual: 'yearly',
    annually: 'yearly',
    'every-year': 'yearly',
    'bi-yearly': 'bi-yearly',
    biyearly: 'bi-yearly',
    biennial: 'bi-yearly',
    'every-2-years': 'bi-yearly',
  }

  return aliases[normalized] ?? null
}

const reportStatusLabel = (status: PmComplianceReportRow['status']) => {
  if (status === 'completed-on-time') return 'Completed On Time'
  if (status === 'completed-late') return 'Completed Late'
  if (status === 'missed') return 'Missed'
  return 'Scheduled'
}

const reportSourceLabel = (sourceType: PmComplianceReportRow['sourceType']) => {
  return sourceType === 'calibration' ? 'Calibration' : 'PM'
}

const reportStatusColor = (status: PmComplianceReportRow['status']) => {
  if (status === 'completed-on-time') return 'success'
  if (status === 'completed-late') return 'warning'
  if (status === 'missed') return 'error'
  return 'secondary'
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
const calibrationAssetsFor = (locationId: number) =>
  assetsFor(locationId).filter((asset) => {
    const dueDate = asset.calDue?.trim() ?? ''
    return dueDate.length > 0 && !asset.calibrationDueCompletedAt
  })

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

const findLocationAsset = (locationId: number, assetId?: number | null) => {
  if (!assetId) return null
  return assetsFor(locationId).find((asset) => asset.id === assetId) ?? null
}

const calibrationHistoryAsset = computed(() => {
  const locationId = activeCalibrationHistoryLocationId.value
  const assetId = activeCalibrationHistoryAssetId.value
  if (!locationId || !assetId) return null
  return findLocationAsset(locationId, assetId)
})

const calibrationHistoryDialogTitle = computed(() => {
  const asset = calibrationHistoryAsset.value
  if (!asset) return 'Calibration Completion History'
  return `Calibration Completion - ${assetDisplayLabel(asset)}`
})

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

const calibrationAssetOptions = computed(() => {
  if (!activeCalibrationLocationId.value) return []
  return assetsFor(activeCalibrationLocationId.value).map((asset) => ({
    title: assetDisplayLabel(asset),
    value: asset.id,
  }))
})

const locationNameFor = (locationId?: number | null) => {
  if (!locationId) return ''
  return locations.value.find((location) => location.id === locationId)?.name ?? ''
}

const noteDialogTitle = computed(() => {
  const name = locationNameFor(activeNoteLocationId.value)
  return name ? `New Note - ${name}` : 'New Note'
})

interface CalendarEvent {
  key: string
  date: string
  title: string
  assetLabel: string
  recurrenceLabel: string
  eventTypeLabel: 'PM' | 'Calibration'
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

const isCheckedValue = (value?: string | null) => {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return ['true', '1', 'yes', 'y', 'checked'].includes(normalized)
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

const loadPmComplianceReport = async () => {
  pmReportLoading.value = true
  pmReportError.value = ''
  try {
    const { start, end } = getMonthBounds(globalCalendarMonth.value)
    const report = await api.getPmComplianceReport({
      start: toIsoDate(start),
      end: toIsoDate(end),
    })
    pmReportRows.value = report.rows
    Object.assign(pmReportSummary, report.summary)
  } catch (error) {
    pmReportRows.value = []
    Object.assign(pmReportSummary, emptyReportSummary())
    pmReportError.value =
      error instanceof Error ? error.message : 'Failed to load maintenance report'
  } finally {
    pmReportLoading.value = false
  }
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
        eventTypeLabel: 'PM',
      })
      occurrence = nextRecurringDate(occurrence, recurrence)
      safety += 1
    }
  }

  for (const asset of assetsFor(locationId)) {
    const firstDate = parseIsoDate(asset.calDue)
    if (!firstDate) continue

    const recurrence = recurrenceFromFrequencyText(asset.calFreq)
    const assetLabel = assetDisplayLabel(asset)

    if (!recurrence) {
      if (firstDate >= startBoundary && firstDate <= endBoundary) {
        events.push({
          key: `cal-${locationId}-${asset.id}-${toIsoDate(firstDate)}`,
          date: toIsoDate(firstDate),
          title: 'Calibration Due',
          assetLabel,
          recurrenceLabel: formatValue(asset.calFreq) === '—' ? 'One-time' : formatValue(asset.calFreq),
          eventTypeLabel: 'Calibration',
        })
      }
      continue
    }

    let occurrence = new Date(firstDate)
    let safety = 0

    while (occurrence < startBoundary && safety < 500) {
      occurrence = nextRecurringDate(occurrence, recurrence)
      safety += 1
    }

    while (occurrence <= endBoundary && safety < 600) {
      events.push({
        key: `cal-${locationId}-${asset.id}-${toIsoDate(occurrence)}-${safety}`,
        date: toIsoDate(occurrence),
        title: 'Calibration Due',
        assetLabel,
        recurrenceLabel: recurrenceLabels[recurrence],
        eventTypeLabel: 'Calibration',
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

const globalCalendarToday = computed(() => todayIso())

const isTodayCalendarDate = (date?: string | null) => {
  if (!date) return false
  return date === globalCalendarToday.value
}

const jumpGlobalCalendarToToday = () => {
  globalCalendarMonth.value = globalCalendarToday.value.slice(0, 7)
}

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
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

const loadUnmatchedAssets = async () => {
  unmatchedAssets.value = await api.getUnmatchedAssets()
}

const refreshUnmatchedAssets = async () => {
  try {
    await loadUnmatchedAssets()
    setSnackbar('Import library refreshed')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh import library'
    setSnackbar(message, 'error')
  }
}

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read CSV file'))
    reader.readAsText(file)
  })

const onCsvFileSelected = async (files: File | File[] | null) => {
  const selected = Array.isArray(files) ? files[0] : files
  if (!selected) return

  try {
    csvImportText.value = await readFileAsText(selected)
    csvImportFileName.value = selected.name
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read CSV file'
    setSnackbar(message, 'error')
  }
}

const openCsvImportDialog = () => {
  csvImportText.value = ''
  csvImportFileName.value = ''
  csvImportDialog.value = true
}

const submitCsvImport = async () => {
  const csvText = csvImportText.value.trim()
  if (!csvText.length) {
    setSnackbar('Upload or paste CSV content first', 'error')
    return
  }

  csvImporting.value = true
  try {
    const result = await api.importAssetsCsv({ csvText })
    csvImportDialog.value = false
    await refreshAll()
    setSnackbar(
      `Import complete: ${result.importedCount} imported, ${result.unmatchedCount} sent to import library, ${result.skippedCount} skipped`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CSV import failed'
    setSnackbar(message, 'error')
  } finally {
    csvImporting.value = false
  }
}

const openUnmatchedEditDialog = (item: UnmatchedAssetImport) => {
  activeUnmatchedEditId.value = item.id
  Object.assign(unmatchedDraft, {
    sourceLocation: item.sourceLocation ?? '',
    mappedLocationId: item.mappedLocationId ?? null,
    aid: item.aid ?? '',
    manufacturerModel: item.manufacturerModel ?? '',
    equipmentDescription: item.equipmentDescription ?? '',
    location: item.location ?? '',
    owner: item.owner ?? '',
    serialNumber: item.serialNumber ?? '',
    revalidationCertification: item.revalidationCertification ?? '',
    sop: item.sop ?? '',
    notes: item.notes ?? '',
  })
  unmatchedEditDialog.value = true
}

const closeUnmatchedEditDialog = () => {
  unmatchedEditDialog.value = false
  activeUnmatchedEditId.value = null
}

const submitUnmatchedEdit = async () => {
  const id = activeUnmatchedEditId.value
  if (!id) return
  unmatchedSaving.value = true
  try {
    const updated = await api.updateUnmatchedAsset(id, cleanPayload({ ...unmatchedDraft }))
    unmatchedAssets.value = unmatchedAssets.value.map((item) =>
      item.id === updated.id ? updated : item
    )
    closeUnmatchedEditDialog()
    setSnackbar('Import row updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update import row'
    setSnackbar(message, 'error')
  } finally {
    unmatchedSaving.value = false
  }
}

const removeUnmatchedAsset = async (id: number) => {
  try {
    await api.deleteUnmatchedAsset(id)
    unmatchedAssets.value = unmatchedAssets.value.filter((item) => item.id !== id)
    setSnackbar('Import row deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete import row'
    setSnackbar(message, 'error')
  }
}

const updateUnmatchedMappedLocation = async (
  item: UnmatchedAssetImport,
  mappedLocationId: number | null
) => {
  try {
    const updated = await api.updateUnmatchedAsset(item.id, { mappedLocationId })
    unmatchedAssets.value = unmatchedAssets.value.map((entry) =>
      entry.id === item.id ? updated : entry
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to map location'
    setSnackbar(message, 'error')
  }
}

const promoteUnmatchedAsset = async (item: UnmatchedAssetImport) => {
  try {
    const result = await api.promoteUnmatchedAsset(item.id, {
      locationId: item.mappedLocationId ?? undefined,
    })
    const locationId = result.locationId
    assets[locationId] = [result.asset, ...(assets[locationId] ?? [])]
    unmatchedAssets.value = unmatchedAssets.value.filter((entry) => entry.id !== item.id)
    setSnackbar('Asset promoted to location library')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to promote import row'
    setSnackbar(message, 'error')
  }
}

const refreshAll = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [locationData, contactData, msGraphStatus, unmatchedData] = await Promise.all([
      api.getLocations(),
      api.getContacts(),
      api.getMsGraphStatus().catch(() => ({
        configured: false,
        userId: null,
        calendarId: null,
      })),
      api.getUnmatchedAssets(),
    ])
    locations.value = locationData
    contacts.value = contactData
    unmatchedAssets.value = unmatchedData
    msGraphConfigured.value = msGraphStatus.configured
    for (const location of locations.value) {
      tabByLocation[location.id] = tabByLocation[location.id] || 'assets'
      calendarMonthByLocation[location.id] =
        calendarMonthByLocation[location.id] || defaultCalendarMonth
      await loadLocationData(location.id)
    }
    await loadPmComplianceReport()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load'
    errorMessage.value = message
    setSnackbar(message, 'error')
  } finally {
    loading.value = false
  }
}

const syncOutlookCalendar = async (options?: {
  locationId?: number
}) => {
  if (!msGraphConfigured.value) {
    setSnackbar(
      'Microsoft Graph is not configured on backend. Set MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, and MS_GRAPH_USER_ID.',
      'error'
    )
    return
  }

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = addMonths(start, 36)

  msGraphSyncing.value = true
  try {
    const result = await api.syncMsGraphCalendar({
      start: toIsoDate(start),
      end: toIsoDate(end),
      locationId: options?.locationId,
    })
    setSnackbar(
      `Outlook sync complete: ${result.createdCount} created, ${result.deletedCount} replaced`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outlook sync failed'
    setSnackbar(message, 'error')
  } finally {
    msGraphSyncing.value = false
  }
}

const openAssetDialog = (locationId: number) => {
  activeAssetLocationId.value = locationId
  activeAssetEditId.value = null
  Object.assign(assetDraft, emptyAssetDraft())
  assetGmpChecked.value = false
  assetDialog.value = true
}

const openEditAssetDialog = (locationId: number, item: Asset) => {
  activeAssetLocationId.value = locationId
  activeAssetEditId.value = item.id
  Object.assign(assetDraft, {
    aid: item.aid ?? '',
    manufacturerModel: item.manufacturerModel ?? '',
    equipmentDescription: item.equipmentDescription ?? '',
    location: item.location ?? '',
    owner: item.owner ?? '',
    serialNumber: item.serialNumber ?? '',
    revalidationCertification: item.revalidationCertification ?? '',
    sop: item.sop ?? '',
    notes: item.notes ?? '',
  })
  assetGmpChecked.value = isCheckedValue(item.gmp)
  assetDialog.value = true
}

const closeAssetDialog = () => {
  assetDialog.value = false
  activeAssetEditId.value = null
}

const openContactDialog = () => {
  activeContactEditId.value = null
  Object.assign(contactDraft, emptyContactDraft())
  contactDialog.value = true
}

const openEditContactDialog = (item: Contact) => {
  activeContactEditId.value = item.id
  Object.assign(contactDraft, {
    company: item.company ?? '',
    contactName: item.contactName ?? '',
    department: item.department ?? '',
    email: item.email ?? '',
    phone: item.phone ?? '',
    mobile: item.mobile ?? '',
    locationName: item.locationName ?? '',
    address: item.address ?? '',
    notes: item.notes ?? '',
  })
  contactDialog.value = true
}

const closeContactDialog = () => {
  contactDialog.value = false
  activeContactEditId.value = null
}

const openCalibrationDialog = (locationId: number) => {
  activeCalibrationLocationId.value = locationId
  Object.assign(calibrationDraft, emptyCalibrationDraft())
  const options = assetsFor(locationId)
  const firstAsset = options[0]
  if (firstAsset) {
    calibrationDraft.assetId = firstAsset.id
  }
  calibrationDialog.value = true
}

const openCalibrationDialogForAsset = (locationId: number, asset: Asset) => {
  openCalibrationDialog(locationId)
  calibrationDraft.assetId = asset.id
}

const loadCalibrationHistory = async (assetId: number) => {
  calibrationHistoryLoading.value = true
  try {
    calibrationHistoryRows.value = await api.getCalibrationCompletionHistory(assetId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load calibration history'
    setSnackbar(message, 'error')
    calibrationHistoryRows.value = []
  } finally {
    calibrationHistoryLoading.value = false
  }
}

const openCalibrationHistoryDialog = async (locationId: number, asset: Asset) => {
  activeCalibrationHistoryLocationId.value = locationId
  activeCalibrationHistoryAssetId.value = asset.id
  calibrationCompletionDraft.dueDate = asset.calDue?.trim() || todayIso()
  calibrationCompletionDraft.completedAt = todayIso()
  calibrationCompletionDraft.notes = ''
  calibrationHistoryDialog.value = true
  await loadCalibrationHistory(asset.id)
}

const closeCalibrationHistoryDialog = () => {
  calibrationHistoryDialog.value = false
  activeCalibrationHistoryLocationId.value = null
  activeCalibrationHistoryAssetId.value = null
}

const openPreventativeDialog = (locationId: number) => {
  activePreventativeLocationId.value = locationId
  Object.assign(preventativeDraft, emptyPreventativeDraft())
  const options = assetsFor(locationId)
  const firstAsset = options[0]
  if (firstAsset) {
    preventativeDraft.assetId = firstAsset.id
  }
  preventativeDialog.value = true
}

const openNoteDialog = (locationId: number) => {
  activeNoteLocationId.value = locationId
  Object.assign(noteDraft, emptyNoteDraft())
  noteDialog.value = true
}

const openCompletionDialog = (
  locationId: number,
  item: PreventativeMaintenance
) => {
  activeCompletionLocationId.value = locationId
  completionDraft.pmId = item.id
  completionDraft.dueDate = item.nextDue?.trim() || todayIso()
  completionDraft.completedAt = todayIso()
  completionDraft.notes = ''
  completionDialog.value = true
}

const submitAsset = async () => {
  if (!activeAssetLocationId.value) return
  assetSaving.value = true
  try {
    const payload = cleanPayload({
      ...assetDraft,
      gmp: assetGmpChecked.value ? 'Yes' : null,
    })
    const editId = activeAssetEditId.value

    if (editId) {
      const updated = await api.updateAsset(editId, payload)
      assets[activeAssetLocationId.value] = assetsFor(
        activeAssetLocationId.value
      ).map((item) => (item.id === updated.id ? updated : item))
      closeAssetDialog()
      setSnackbar('Asset updated')
    } else {
      const created = await api.createAsset(activeAssetLocationId.value, payload)
      assets[activeAssetLocationId.value] = [
        created,
        ...assetsFor(activeAssetLocationId.value),
      ]
      closeAssetDialog()
      setSnackbar('Asset saved to library')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save'
    setSnackbar(message, 'error')
  } finally {
    assetSaving.value = false
  }
}

const submitCalibration = async () => {
  const locationId = activeCalibrationLocationId.value
  const assetId = calibrationDraft.assetId
  if (!locationId || !assetId) {
    setSnackbar('Select an asset to update calibration', 'error')
    return
  }

  calibrationSaving.value = true
  try {
    const payload = cleanPayload({
      calDue: calibrationDraft.calDue,
      calFreq: calibrationDraft.calFreq,
      calibrationRange: calibrationDraft.calibrationRange,
    })
    const updated = await api.updateAsset(assetId, payload)
    assets[locationId] = assetsFor(locationId).map((item) =>
      item.id === updated.id ? updated : item
    )
    calibrationDialog.value = false
    setSnackbar('Calibration saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save calibration'
    setSnackbar(message, 'error')
  } finally {
    calibrationSaving.value = false
  }
}

const submitCalibrationCompletion = async () => {
  const locationId = activeCalibrationHistoryLocationId.value
  const assetId = activeCalibrationHistoryAssetId.value
  if (!locationId || !assetId) return

  const dueDate = calibrationCompletionDraft.dueDate.trim()
  const completedAt = calibrationCompletionDraft.completedAt.trim()
  if (!dueDate || !completedAt) {
    setSnackbar('Due date and completed date are required', 'error')
    return
  }

  calibrationHistorySaving.value = true
  try {
    const result = await api.createCalibrationCompletionHistory(assetId, {
      dueDate,
      completedAt,
      notes: calibrationCompletionDraft.notes.trim() || null,
    })

    assets[locationId] = assetsFor(locationId).map((item) =>
      item.id === result.asset.id ? result.asset : item
    )
    calibrationCompletionDraft.dueDate = result.asset.calDue?.trim() || dueDate
    calibrationCompletionDraft.completedAt = todayIso()
    calibrationCompletionDraft.notes = ''
    await loadCalibrationHistory(assetId)
    setSnackbar('Calibration completion logged')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to log calibration completion'
    setSnackbar(message, 'error')
  } finally {
    calibrationHistorySaving.value = false
  }
}

const submitContact = async () => {
  contactSaving.value = true
  try {
    const payload = cleanPayload({ ...contactDraft })
    const editId = activeContactEditId.value
    if (editId) {
      const updated = await api.updateContact(editId, payload)
      contacts.value = contacts.value.map((item) =>
        item.id === updated.id ? updated : item
      )
      closeContactDialog()
      setSnackbar('Contact updated')
    } else {
      const created = await api.createContact(payload)
      contacts.value = [created, ...contacts.value]
      closeContactDialog()
      setSnackbar('Contact saved')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save contact'
    setSnackbar(message, 'error')
  } finally {
    contactSaving.value = false
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

const submitCompletion = async () => {
  const locationId = activeCompletionLocationId.value
  const pmId = completionDraft.pmId
  if (!locationId || !pmId) return

  const dueDate = completionDraft.dueDate.trim()
  const completedAt = completionDraft.completedAt.trim()
  if (!dueDate || !completedAt) {
    setSnackbar('Due date and completed date are required', 'error')
    return
  }

  completionSaving.value = true
  try {
    const result = await api.createPreventativeCompletionHistory(pmId, {
      dueDate,
      completedAt,
      notes: completionDraft.notes.trim() || null,
    })
    preventatives[locationId] = preventativesFor(locationId).map((item) =>
      item.id === pmId ? result.preventativeMaintenance : item
    )
    completionDialog.value = false
    setSnackbar('PM completion logged')
    await loadPmComplianceReport()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to log completion'
    setSnackbar(message, 'error')
  } finally {
    completionSaving.value = false
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

const removeContact = async (id: number) => {
  try {
    await api.deleteContact(id)
    contacts.value = contacts.value.filter((item) => item.id !== id)
    setSnackbar('Contact deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete'
    setSnackbar(message, 'error')
  }
}

onMounted(() => {
  refreshAll()
})

watch(
  [() => activeCalibrationLocationId.value, () => calibrationDraft.assetId],
  ([locationId, assetId]) => {
    if (!locationId || !assetId) return
    const asset = findLocationAsset(locationId, assetId)
    if (!asset) return

    calibrationDraft.calDue = asset.calDue ?? ''
    calibrationDraft.calFreq = asset.calFreq ?? ''
    calibrationDraft.calibrationRange = asset.calibrationRange ?? ''
    calibrationDraft.lastCalibration = asset.lastCalibration ?? ''
  }
)

watch(
  [() => activePreventativeLocationId.value, () => preventativeDraft.assetId],
  ([locationId, assetId]) => {
    if (!locationId || !assetId) return
    const asset = findLocationAsset(locationId, assetId)
    if (!asset) return

    preventativeDraft.lastPm = asset.lastPm ?? ''
  }
)

watch(globalCalendarMonth, () => {
  loadPmComplianceReport()
})
</script>

<template>
  <v-app>
    <div class="app-bg">
      <header class="top-bar">
        <div class="brand-block">
          <img :src="wideLogo" alt="Qualgen logo" class="brand-banner" />
          <div>
            <h1>{{ pageTitle }}</h1>
            <p class="subtitle">
              {{ pageSubtitle }}
            </p>
          </div>
        </div>
        <div class="top-actions">
          <v-btn
            color="primary"
            :variant="viewMode === 'locations' ? 'flat' : 'tonal'"
            @click="setViewMode('locations')"
          >
            Location Boards
          </v-btn>
          <v-btn
            color="primary"
            :variant="viewMode === 'global-calendar' ? 'flat' : 'tonal'"
            @click="setViewMode('global-calendar')"
          >
            Calendar
          </v-btn>
          <v-btn
            color="primary"
            :variant="viewMode === 'contacts' ? 'flat' : 'tonal'"
            @click="setViewMode('contacts')"
          >
            Contacts
          </v-btn>
          <v-btn
            color="primary"
            :variant="viewMode === 'imports' ? 'flat' : 'tonal'"
            @click="setViewMode('imports')"
          >
            Import Library
          </v-btn>
          <v-btn variant="tonal" color="secondary" @click="openCsvImportDialog">
            Import CSV
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
        <div v-for="location in sortedLocations" :key="location.id" class="location-stack">
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
              </div>
            </div>

            <v-tabs
              v-model="tabByLocation[location.id]"
              color="primary"
              density="compact"
            >
              <v-tab value="assets">Assets</v-tab>
              <v-tab value="pm">PMs and Calibrations</v-tab>
              <v-tab value="calendar">Calendar</v-tab>
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
                        <th v-for="header in assetTableFields" :key="header.key">
                          {{ header.label }}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in assetsFor(location.id)" :key="item.id">
                        <td v-for="header in assetTableFields" :key="header.key">
                          {{
                            formatValue(
                              item[header.key as keyof Asset] as string | null
                            )
                          }}
                        </td>
                        <td>
                          <v-btn
                            icon="mdi-pencil"
                            size="x-small"
                            variant="text"
                            @click="openEditAssetDialog(location.id, item)"
                          />
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
                <div class="pm-section-head">
                  <div class="pm-section-title">Preventative Maintenance</div>
                  <v-btn
                    size="x-small"
                    color="secondary"
                    variant="tonal"
                    @click="openPreventativeDialog(location.id)"
                  >
                    Add PM
                  </v-btn>
                </div>
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
                      <span>Last PM: {{ formatDate(item.lastPm) }}</span>
                      <span>Last: {{ formatDate(item.lastCompleted) }}</span>
                      <span>First/Next Due: {{ formatDate(item.nextDue) }}</span>
                    </div>
                    <div class="pm-notes">
                      {{ formatValue(item.notes) }}
                    </div>
                    <div class="pm-actions">
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        @click="openCompletionDialog(location.id, item)"
                      >
                        Log Completion
                      </v-btn>
                      <v-btn
                        icon="mdi-delete"
                        size="x-small"
                        variant="text"
                        @click="removePreventative(location.id, item.id)"
                      />
                    </div>
                  </v-card>
                </div>

                <div class="pm-section-head calibration-section-head">
                  <div class="pm-section-title">Calibrations</div>
                  <v-btn
                    size="x-small"
                    color="secondary"
                    variant="outlined"
                    @click="openCalibrationDialog(location.id)"
                  >
                    Add Calibration
                  </v-btn>
                </div>
                <div v-if="!calibrationAssetsFor(location.id).length" class="empty">
                  No open calibration due items. Completed calibrations are hidden.
                </div>
                <div v-else class="pm-list">
                  <v-card
                    v-for="asset in calibrationAssetsFor(location.id)"
                    :key="`cal-${asset.id}`"
                    class="pm-card"
                    elevation="2"
                  >
                    <div class="pm-title">
                      {{ assetDisplayLabel(asset) }}
                    </div>
                    <div class="pm-meta">
                      <span>Cal Due: {{ formatDate(asset.calDue) || '—' }}</span>
                      <span>Frequency: {{ formatValue(asset.calFreq) }}</span>
                      <span>Last Cal: {{ formatDate(asset.lastCalibration) || '—' }}</span>
                      <span>Range: {{ formatValue(asset.calibrationRange) }}</span>
                    </div>
                    <div class="pm-actions">
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        @click="openCalibrationHistoryDialog(location.id, asset)"
                      >
                        Log Completion
                      </v-btn>
                      <v-btn
                        size="x-small"
                        variant="text"
                        @click="openCalibrationDialogForAsset(location.id, asset)"
                      >
                        Edit Calibration
                      </v-btn>
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
                  <div class="calendar-toolbar-actions">
                    <v-chip color="primary" variant="tonal" size="small">
                      {{ calendarCountForMonth(location.id) }} scheduled
                    </v-chip>
                    <v-btn
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-calendar-export"
                      :href="locationCalendarIcsUrl(location.id)"
                      target="_blank"
                    >
                      ICS Feed
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-microsoft-outlook"
                      :loading="msGraphSyncing"
                      :disabled="!msGraphConfigured"
                      @click="syncOutlookCalendar({ locationId: location.id })"
                    >
                      Sync Outlook
                    </v-btn>
                  </div>
                </div>

                <div
                  v-if="!calendarEventsForMonth(location.id).length"
                  class="empty"
                >
                  No PM or calibration dates scheduled for this month. Add PMs and
                  calibration frequency to populate the calendar.
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
                          {{ event.eventTypeLabel }} · {{ event.assetLabel }} ·
                          {{ event.recurrenceLabel }}
                        </div>
                      </div>
                    </div>
                  </v-card>
                </div>
              </v-window-item>

            </v-window>
          </v-card>
          <v-card class="lane-card notes-lane-card" elevation="8">
            <div class="notes-card-header">
              <div>
                <div class="notes-card-title">{{ location.name }} Notes</div>
                <div class="lane-meta">{{ notesFor(location.id).length }} notes</div>
              </div>
              <v-btn
                size="small"
                color="secondary"
                variant="outlined"
                @click="openNoteDialog(location.id)"
              >
                Add Note
              </v-btn>
            </div>
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
          </v-card>
        </div>
      </div>

      <div v-else-if="viewMode === 'global-calendar'" class="global-calendar-page">
        <v-card class="global-calendar-card" elevation="8">
          <div class="global-calendar-header">
            <div>
              <div class="global-calendar-title">{{ globalCalendarMonthLabel }}</div>
              <div class="lane-meta">
                All scheduled PM and calibration occurrences across locations
              </div>
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
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-calendar-today"
                  @click="jumpGlobalCalendarToToday"
                >
                  Today
                </v-btn>
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
              <div class="calendar-toolbar-actions">
                <v-chip color="primary" variant="tonal" size="small">
                  {{ globalCalendarTotal }} scheduled
                </v-chip>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-calendar-export"
                  :href="globalCalendarIcsUrl"
                  target="_blank"
                >
                  ICS Feed
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-microsoft-outlook"
                  :loading="msGraphSyncing"
                  :disabled="!msGraphConfigured"
                  @click="syncOutlookCalendar()"
                >
                  Sync Outlook
                </v-btn>
              </div>
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
              :class="{ 'is-empty': !cell.date, 'is-today': isTodayCalendarDate(cell.date) }"
            >
              <template v-if="cell.date">
                <div class="global-calendar-day-row">
                  <div class="global-calendar-day">{{ cell.dayLabel }}</div>
                  <v-chip
                    v-if="isTodayCalendarDate(cell.date)"
                    size="x-small"
                    color="primary"
                    variant="flat"
                  >
                    Today
                  </v-chip>
                </div>
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
                      {{ event.eventTypeLabel }} · {{ event.recurrenceLabel }}
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div v-if="!globalCalendarTotal" class="empty global-calendar-empty">
            No PM or calibration dates scheduled for this month.
          </div>

          <div class="report-block">
            <div class="report-head">
              <div class="global-calendar-title">Maintenance Compliance Report</div>
              <div class="report-summary">
                <v-chip size="small" color="success" variant="tonal">
                  On Time: {{ pmReportSummary.completedOnTime }}
                </v-chip>
                <v-chip size="small" color="warning" variant="tonal">
                  Late: {{ pmReportSummary.completedLate }}
                </v-chip>
                <v-chip size="small" color="error" variant="tonal">
                  Missed: {{ pmReportSummary.missed }}
                </v-chip>
              </div>
            </div>

            <div v-if="pmReportError" class="error-banner">
              {{ pmReportError }}
            </div>

            <div v-else-if="pmReportLoading" class="empty">
              Loading compliance report...
            </div>

            <div v-else-if="!pmReportRows.length" class="empty">
              No maintenance report rows for this month.
            </div>

            <div v-else class="table-wrap report-table">
              <v-table density="compact" fixed-header height="280">
                <thead>
                  <tr>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Item</th>
                    <th>Asset</th>
                    <th>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in pmReportRows" :key="row.reportKey">
                    <td>{{ formatDate(row.dueDate) }}</td>
                    <td>
                      <v-chip
                        size="x-small"
                        :color="reportStatusColor(row.status)"
                        variant="outlined"
                      >
                        {{ reportStatusLabel(row.status) }}
                      </v-chip>
                    </td>
                    <td>{{ reportSourceLabel(row.sourceType) }}</td>
                    <td>{{ row.locationName }}</td>
                    <td>{{ formatValue(row.title) }}</td>
                    <td>{{ row.assetLabel }}</td>
                    <td>{{ formatDate(row.completedAt) || '—' }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>
        </v-card>
      </div>

      <div v-else-if="viewMode === 'imports'" class="imports-page">
        <v-card class="imports-card" elevation="8">
          <div class="contacts-header">
            <div>
              <div class="global-calendar-title">Unmatched Asset Import Library</div>
              <div class="lane-meta">
                {{ unmatchedAssets.length }} rows awaiting location mapping
              </div>
            </div>
            <div class="calendar-toolbar-actions">
              <v-select
                v-model="unmatchedSortBy"
                :items="unmatchedSortOptions"
                item-title="title"
                item-value="value"
                label="Sort By"
                density="comfortable"
                variant="outlined"
                hide-details
                class="calendar-month-input"
              />
              <v-btn size="small" color="primary" variant="flat" @click="refreshUnmatchedAssets">
                Refresh
              </v-btn>
            </div>
          </div>

          <div v-if="!sortedUnmatchedAssets.length" class="empty">
            No unmatched imported rows. CSV rows with unknown locations will appear here.
          </div>

          <div v-else class="table-wrap">
            <v-table class="imports-table" density="compact" fixed-header height="520">
              <thead>
                <tr>
                  <th>Source Location</th>
                  <th>Mapped Location</th>
                  <th>Asset ID</th>
                  <th>Manufacturer/Model</th>
                  <th>Equipment Description</th>
                  <th>Owner</th>
                  <th class="imports-col-serial">Serial Number</th>
                  <th class="imports-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in sortedUnmatchedAssets" :key="item.id">
                  <td>{{ formatValue(item.sourceLocation) }}</td>
                  <td>
                    <v-select
                      v-model="item.mappedLocationId"
                      :items="locationOptions"
                      item-title="title"
                      item-value="value"
                      density="compact"
                      variant="underlined"
                      hide-details
                      clearable
                      class="inline-select"
                      @update:model-value="updateUnmatchedMappedLocation(item, item.mappedLocationId ?? null)"
                    />
                  </td>
                  <td>{{ formatValue(item.aid) }}</td>
                  <td>{{ formatValue(item.manufacturerModel) }}</td>
                  <td>{{ formatValue(item.equipmentDescription) }}</td>
                  <td>{{ formatValue(item.owner) }}</td>
                  <td class="imports-col-serial">{{ formatValue(item.serialNumber) }}</td>
                  <td class="imports-col-actions">
                    <v-btn
                      icon="mdi-pencil"
                      size="x-small"
                      variant="text"
                      @click="openUnmatchedEditDialog(item)"
                    />
                    <v-btn
                      icon="mdi-check-bold"
                      size="x-small"
                      variant="text"
                      @click="promoteUnmatchedAsset(item)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="x-small"
                      variant="text"
                      @click="removeUnmatchedAsset(item.id)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card>
      </div>

      <div v-else class="contacts-page">
        <v-card class="contacts-card" elevation="8">
          <div class="contacts-header">
            <div>
              <div class="global-calendar-title">Business Contacts</div>
              <div class="lane-meta">{{ contacts.length }} contacts in directory</div>
            </div>
            <v-btn color="primary" variant="flat" @click="openContactDialog">
              Add Contact
            </v-btn>
          </div>

          <div v-if="!contacts.length" class="empty">
            No contacts yet. Add a business contact to build your directory.
          </div>

          <div v-else class="table-wrap">
            <v-table density="compact" fixed-header height="520">
              <thead>
                <tr>
                  <th v-for="header in contactTableFields" :key="header.key">
                    {{ header.label }}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in contacts" :key="item.id">
                  <td v-for="header in contactTableFields" :key="header.key">
                    {{ formatValue(item[header.key as keyof Contact] as string | null) }}
                  </td>
                  <td>
                    <v-btn
                      icon="mdi-pencil"
                      size="x-small"
                      variant="text"
                      @click="openEditContactDialog(item)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="x-small"
                      variant="text"
                      @click="removeContact(item.id)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card>
      </div>
    </div>

    <v-dialog v-model="contactDialog" max-width="860">
      <v-card class="dialog-card">
        <v-card-title>{{ contactDialogTitle }}</v-card-title>
        <v-card-text>
          <div class="dialog-grid">
            <v-text-field
              v-model="contactDraft.company"
              label="Company"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="contactDraft.contactName"
              label="Contact Name"
              variant="outlined"
              density="comfortable"
              hide-details
            />

            <v-text-field
              v-model="contactDraft.department"
              label="Department"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="contactDraft.email"
              label="Email"
              type="email"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="contactDraft.phone"
              label="Office Phone"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="contactDraft.mobile"
              label="Mobile"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="contactDraft.locationName"
              label="Location/Site"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="contactDraft.address"
              label="Address"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </div>
          <v-textarea
            v-model="contactDraft.notes"
            label="Notes"
            variant="outlined"
            density="comfortable"
            rows="3"
            hide-details
            class="contact-notes"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeContactDialog">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="contactSaving"
            @click="submitContact"
          >
            {{ contactDialogSaveLabel }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="assetDialog" max-width="900">
      <v-card class="dialog-card">
        <v-card-title>{{ assetDialogTitle }}</v-card-title>
        <v-card-text>
          <div class="asset-checkbox-row">
            <v-checkbox
              v-model="assetGmpChecked"
              label="GMP"
              density="compact"
              hide-details
            />
          </div>
          <div class="dialog-grid">
            <v-text-field
              v-for="field in assetDialogFields"
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
          <v-btn variant="text" @click="closeAssetDialog">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="assetSaving"
            @click="submitAsset"
          >
            {{ assetDialogSaveLabel }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="calibrationDialog" max-width="640">
      <v-card class="dialog-card">
        <v-card-title>Add Calibration</v-card-title>
        <v-card-text>
          <div class="dialog-grid small">
            <v-select
              v-model="calibrationDraft.assetId"
              label="Asset"
              :items="calibrationAssetOptions"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              hide-details
              :disabled="!calibrationAssetOptions.length"
            />
            <v-text-field
              v-model="calibrationDraft.calDue"
              label="Cal Due"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="calibrationDraft.calFreq"
              label="Cal Freq"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="calibrationDraft.calibrationRange"
              label="Cal Range"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="calibrationDraft.lastCalibration"
              label="Last Cal"
              type="date"
              variant="outlined"
              density="comfortable"
              readonly
              hide-details
            />
          </div>
          <div
            v-if="!calibrationAssetOptions.length"
            class="pm-dialog-hint"
          >
            Add at least one asset for this site before logging calibration details.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="calibrationDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="calibrationSaving"
            :disabled="!calibrationAssetOptions.length"
            @click="submitCalibration"
          >
            Save Calibration
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="calibrationHistoryDialog" max-width="900">
      <v-card class="dialog-card">
        <v-card-title>{{ calibrationHistoryDialogTitle }}</v-card-title>
        <v-card-text>
          <div class="dialog-grid">
            <v-text-field
              v-model="calibrationCompletionDraft.dueDate"
              label="Due Date"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="calibrationCompletionDraft.completedAt"
              label="Completed Date"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              :model-value="formatDate(calibrationHistoryAsset?.lastCalibration) || '—'"
              label="Latest Completed"
              variant="outlined"
              density="comfortable"
              readonly
              hide-details
            />
          </div>

          <v-textarea
            v-model="calibrationCompletionDraft.notes"
            label="Completion Notes"
            variant="outlined"
            density="comfortable"
            rows="2"
            class="calibration-history-notes"
            hide-details
          />

          <div class="calibration-history-head">History</div>

          <div v-if="calibrationHistoryLoading" class="empty">
            Loading calibration history...
          </div>
          <div v-else-if="!calibrationHistoryRows.length" class="empty">
            No calibration completions logged yet.
          </div>
          <div v-else class="table-wrap calibration-history-table">
            <v-table density="compact" fixed-header height="220">
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Completed Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in calibrationHistoryRows" :key="entry.id">
                  <td>{{ formatDate(entry.dueDate) }}</td>
                  <td>{{ formatDate(entry.completedAt) || '—' }}</td>
                  <td>{{ formatValue(entry.notes) }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeCalibrationHistoryDialog">
            Close
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="calibrationHistorySaving"
            @click="submitCalibrationCompletion"
          >
            Log Completion
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
              v-model="preventativeDraft.lastPm"
              label="Last PM"
              type="date"
              variant="outlined"
              density="comfortable"
              readonly
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

    <v-dialog v-model="completionDialog" max-width="520">
      <v-card class="dialog-card">
        <v-card-title>Log PM Completion</v-card-title>
        <v-card-text>
          <div class="dialog-grid small">
            <v-text-field
              v-model="completionDraft.dueDate"
              label="Due Date"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="completionDraft.completedAt"
              label="Completed Date"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-textarea
              v-model="completionDraft.notes"
              label="Completion Notes"
              variant="outlined"
              density="comfortable"
              rows="3"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="completionDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="completionSaving"
            @click="submitCompletion"
          >
            Save Completion
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="noteDialog" max-width="520">
      <v-card class="dialog-card">
        <v-card-title>{{ noteDialogTitle }}</v-card-title>
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

    <v-dialog v-model="csvImportDialog" max-width="900">
      <v-card class="dialog-card">
        <v-card-title>Import Assets from CSV</v-card-title>
        <v-card-text>
          <v-file-input
            accept=".csv,text/csv"
            label="Select CSV File"
            variant="outlined"
            density="comfortable"
            show-size
            @update:model-value="onCsvFileSelected"
          />
          <div v-if="csvImportFileName" class="lane-meta import-file-name">
            Loaded: {{ csvImportFileName }}
          </div>
          <v-textarea
            v-model="csvImportText"
            label="CSV Content"
            variant="outlined"
            density="comfortable"
            rows="14"
            hide-details
            class="import-csv-textarea"
          />
          <div class="lane-meta import-helper">
            Include a header row. Supported headers include Asset ID, Manufacturer/Model,
            Equipment Description, Location, Owner, Serial Number, SOP, and Notes.
            Unknown locations are sent to the Import Library.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="csvImportDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="csvImporting"
            @click="submitCsvImport"
          >
            Import CSV
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="unmatchedEditDialog" max-width="900">
      <v-card class="dialog-card">
        <v-card-title>Edit Imported Row</v-card-title>
        <v-card-text>
          <div class="dialog-grid">
            <v-text-field
              v-model="unmatchedDraft.sourceLocation"
              label="Source Location"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-select
              v-model="unmatchedDraft.mappedLocationId"
              label="Mapped Location"
              :items="locationOptions"
              item-title="title"
              item-value="value"
              clearable
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.aid"
              label="Asset ID"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.manufacturerModel"
              label="Manufacturer/Model"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.equipmentDescription"
              label="Equipment Description"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.location"
              label="Location (Asset Field)"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.owner"
              label="Owner"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.serialNumber"
              label="Serial Number"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.revalidationCertification"
              label="Revalidation/Certification?"
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-text-field
              v-model="unmatchedDraft.sop"
              label="SOP"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </div>
          <v-textarea
            v-model="unmatchedDraft.notes"
            label="Notes"
            variant="outlined"
            density="comfortable"
            rows="3"
            hide-details
            class="contact-notes"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeUnmatchedEditDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="unmatchedSaving"
            @click="submitUnmatchedEdit"
          >
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-app>
</template>
