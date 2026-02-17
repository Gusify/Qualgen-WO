import 'reflect-metadata'
import './loadEnv'
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { Op, Transaction } from 'sequelize'
import { initDb, sequelize } from './db'
import { Location } from './models/Location'
import { WorkOrder } from './models/WorkOrder'
import { Asset } from './models/Asset'
import { PreventativeMaintenance } from './models/PreventativeMaintenance'
import { LocationNote } from './models/LocationNote'
import { PmCompletionHistory } from './models/PmCompletionHistory'
import { CalibrationCompletionHistory } from './models/CalibrationCompletionHistory'
import { Contact } from './models/Contact'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const workOrderSchema = z.object({
  aid: z.string().optional().nullable(),
  manufacturerModel: z.string().optional().nullable(),
  equipmentDescription: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  activeRetired: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  calDue: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  gmp: z.string().optional().nullable(),
  pmFreq: z.string().optional().nullable(),
  lastPm: z.string().optional().nullable(),
  pm: z.string().optional().nullable(),
  revalidationCertification: z.string().optional().nullable(),
  calFreq: z.string().optional().nullable(),
  lastCalibration: z.string().optional().nullable(),
  calibrationRange: z.string().optional().nullable(),
  sop: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reviewerInitialDate: z.string().optional().nullable(),
  reconciledWithCrossList: z.string().optional().nullable(),
})

const assetSchema = workOrderSchema

const recurrenceValues = [
  'weekly',
  'bi-weekly',
  'monthly',
  'bi-monthly',
  'quarterly',
  'every-6-months',
  'yearly',
  'bi-yearly',
] as const

const recurrenceSchema = z.enum(recurrenceValues)

const preventativeSchema = z.object({
  assetId: z.number().int().positive(),
  recurrence: recurrenceSchema,
  title: z.string().optional().nullable(),
  pmFreq: z.string().optional().nullable(),
  lastPm: z.string().optional().nullable(),
  pm: z.string().optional().nullable(),
  revalidationCertification: z.string().optional().nullable(),
  lastCompleted: z.string().optional().nullable(),
  nextDue: z.string().min(1),
  notes: z.string().optional().nullable(),
})

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
const isoDateSchema = z
  .string()
  .regex(isoDateRegex, 'Date must be in YYYY-MM-DD format')

const completionHistorySchema = z.object({
  dueDate: isoDateSchema,
  completedAt: isoDateSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
})

const calibrationCompletionHistorySchema = completionHistorySchema

const pmComplianceReportQuerySchema = z.object({
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
  locationId: z.coerce.number().int().positive().optional(),
})

const calendarFeedQuerySchema = z.object({
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
})

const msGraphSyncSchema = z.object({
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
  locationId: z.number().int().positive().optional(),
  dryRun: z.boolean().optional(),
})

const noteSchema = z.object({
  content: z.string().min(1),
})

const contactSchema = z.object({
  company: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  locationName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type RecurrenceValue = (typeof recurrenceValues)[number]

const parseIsoDate = (value: string) => {
  if (!isoDateRegex.test(value)) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayIso = () => toIsoDate(new Date())

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

const asRecurrence = (value?: string | null): RecurrenceValue | null => {
  if (!value) return null
  return recurrenceValues.includes(value as RecurrenceValue)
    ? (value as RecurrenceValue)
    : null
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

const getLatestCompletedPmDateForPreventative = async (
  preventativeMaintenanceId: number,
  transaction?: Transaction
) => {
  const latest = await PmCompletionHistory.findOne({
    where: {
      preventativeMaintenanceId,
      completedAt: { [Op.not]: null },
    },
    order: [['completedAt', 'DESC']],
    transaction,
  })
  return latest?.completedAt ?? null
}

const getLatestCompletedPmDateForAsset = async (
  assetId: number,
  transaction?: Transaction
) => {
  const latest = await PmCompletionHistory.findOne({
    where: {
      assetId,
      completedAt: { [Op.not]: null },
    },
    order: [['completedAt', 'DESC']],
    transaction,
  })
  return latest?.completedAt ?? null
}

const getLatestCompletedCalibrationDateForAsset = async (
  assetId: number,
  transaction?: Transaction
) => {
  const latest = await CalibrationCompletionHistory.findOne({
    where: {
      assetId,
      completedAt: { [Op.not]: null },
    },
    order: [['completedAt', 'DESC']],
    transaction,
  })
  return latest?.completedAt ?? null
}

const getCalibrationCompletedDateForDueDate = async (
  assetId: number,
  dueDate?: string | null,
  transaction?: Transaction
) => {
  const normalizedDueDate = dueDate?.trim()
  if (!normalizedDueDate) return null

  const completion = await CalibrationCompletionHistory.findOne({
    where: {
      assetId,
      dueDate: normalizedDueDate,
      completedAt: { [Op.not]: null },
    },
    order: [['completedAt', 'DESC']],
    transaction,
  })
  return completion?.completedAt ?? null
}

const syncAssetLastCalibrationFromHistory = async (
  assetId: number,
  transaction?: Transaction
) => {
  const [asset, latestCompletedAt] = await Promise.all([
    Asset.findByPk(assetId, { transaction }),
    getLatestCompletedCalibrationDateForAsset(assetId, transaction),
  ])
  if (!asset) return null

  const normalizedCurrent = asset.lastCalibration ?? null
  const normalizedNext = latestCompletedAt ?? normalizedCurrent
  if (normalizedCurrent !== normalizedNext) {
    asset.lastCalibration = normalizedNext
    await asset.save({ transaction })
  }

  return normalizedNext
}

const syncAssetLastPmFromHistory = async (
  assetId: number,
  transaction?: Transaction
) => {
  const [asset, latestCompletedAt] = await Promise.all([
    Asset.findByPk(assetId, { transaction }),
    getLatestCompletedPmDateForAsset(assetId, transaction),
  ])
  if (!asset) return null

  const normalizedCurrent = asset.lastPm ?? null
  const normalizedNext = latestCompletedAt ?? normalizedCurrent
  if (normalizedCurrent !== normalizedNext) {
    asset.lastPm = normalizedNext
    await asset.save({ transaction })
  }

  return normalizedNext
}

const withDerivedAssetFields = async (asset: Asset) => {
  const [latestPmCompletedAt, latestCalibrationCompletedAt, calibrationDueCompletedAt] =
    await Promise.all([
    getLatestCompletedPmDateForAsset(asset.id),
    getLatestCompletedCalibrationDateForAsset(asset.id),
    getCalibrationCompletedDateForDueDate(asset.id, asset.calDue),
  ])
  return {
    ...asset.toJSON(),
    lastPm: latestPmCompletedAt ?? asset.lastPm ?? null,
    lastCalibration: latestCalibrationCompletedAt ?? asset.lastCalibration ?? null,
    calibrationDueCompletedAt,
  }
}

const withDerivedPreventativeFields = async (item: PreventativeMaintenance) => {
  const latestCompletedAt = await getLatestCompletedPmDateForPreventative(item.id)
  return {
    ...item.toJSON(),
    lastPm: latestCompletedAt ?? item.lastPm ?? null,
  }
}

const buildDueDatesInRange = (
  pm: PreventativeMaintenance,
  startDate: Date,
  endDate: Date
) => {
  const recurrence = asRecurrence(pm.recurrence ?? pm.frequency)
  const anchorRaw = pm.scheduleAnchor ?? pm.nextDue
  if (!recurrence || !anchorRaw) return [] as string[]

  const anchor = parseIsoDate(anchorRaw)
  if (!anchor) return [] as string[]

  const dueDates: string[] = []
  let occurrence = new Date(anchor)
  let safety = 0

  while (occurrence < startDate && safety < 500) {
    occurrence = nextRecurringDate(occurrence, recurrence)
    safety += 1
  }

  while (occurrence <= endDate && safety < 700) {
    dueDates.push(toIsoDate(occurrence))
    occurrence = nextRecurringDate(occurrence, recurrence)
    safety += 1
  }

  return dueDates
}

const asFlexibleRecurrence = (value?: string | null): RecurrenceValue | null => {
  if (!value) return null
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')

  const direct = asRecurrence(normalized)
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

const buildCalibrationDueDatesInRange = (
  asset: Asset,
  startDate: Date,
  endDate: Date
) => {
  const anchorRaw = asset.calDue
  if (!anchorRaw) return [] as string[]

  const anchor = parseIsoDate(anchorRaw)
  if (!anchor) return [] as string[]

  const recurrence = asFlexibleRecurrence(asset.calFreq)
  if (!recurrence) {
    if (anchor >= startDate && anchor <= endDate) {
      return [toIsoDate(anchor)]
    }
    return [] as string[]
  }

  const dueDates: string[] = []
  let occurrence = new Date(anchor)
  let safety = 0

  while (occurrence < startDate && safety < 500) {
    occurrence = nextRecurringDate(occurrence, recurrence)
    safety += 1
  }

  while (occurrence <= endDate && safety < 700) {
    dueDates.push(toIsoDate(occurrence))
    occurrence = nextRecurringDate(occurrence, recurrence)
    safety += 1
  }

  return dueDates
}

const assetLabelFor = (asset?: Asset | null) => {
  if (!asset) return 'Unassigned Asset'
  const label = [asset.aid, asset.manufacturerModel, asset.equipmentDescription]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length)
    .join(' · ')
  return label || `Asset #${asset.id}`
}

const escapeIcsText = (value: string) => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

const toIcsDate = (isoDate: string) => isoDate.replace(/-/g, '')

const toIcsStamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

interface IcsFeedEvent {
  uid: string
  date: string
  summary: string
  description?: string
  location?: string
}

const buildIcsCalendar = (calendarName: string, events: IcsFeedEvent[]) => {
  const dtStamp = toIcsStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Qualgen//Maintenance Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ]

  for (const event of events) {
    const startDate = parseIsoDate(event.date)
    if (!startDate) continue
    const endDate = addDays(startDate, 1)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${escapeIcsText(event.uid)}`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(event.date)}`)
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(toIsoDate(endDate))}`)
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`)
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`)
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

interface CalendarFeedOptions {
  startDate: Date
  endDate: Date
  locationId?: number
}

const buildCalendarFeedEvents = async (options: CalendarFeedOptions) => {
  const whereByLocation = options.locationId
    ? { locationId: options.locationId }
    : undefined

  const [locations, assets, pms] = await Promise.all([
    Location.findAll({
      where: whereByLocation,
      order: [['id', 'ASC']],
    }),
    Asset.findAll({
      where: whereByLocation,
      order: [['id', 'ASC']],
    }),
    PreventativeMaintenance.findAll({
      where: whereByLocation,
      order: [['id', 'ASC']],
    }),
  ])

  const locationNameById = Object.fromEntries(
    locations.map((location) => [location.id, location.name])
  )
  const assetById = Object.fromEntries(assets.map((asset) => [asset.id, asset]))
  const events: IcsFeedEvent[] = []

  for (const pm of pms) {
    const dueDates = buildDueDatesInRange(pm, options.startDate, options.endDate)
    if (!dueDates.length) continue

    const locationName =
      locationNameById[pm.locationId] ?? `Location #${pm.locationId}`
    const linkedAsset = pm.assetId ? assetById[pm.assetId] : null
    const assetLabel = assetLabelFor(linkedAsset)
    const recurrence = asRecurrence(pm.recurrence ?? pm.frequency)
    const title = pm.title?.trim() || assetLabel

    for (const dueDate of dueDates) {
      events.push({
        uid: `qualgen-pm-${pm.id}-${dueDate}@qualgen.local`,
        date: dueDate,
        summary: `PM Due - ${title}`,
        description: [
          `Type: Preventative Maintenance`,
          `Asset: ${assetLabel}`,
          recurrence ? `Recurrence: ${recurrence}` : null,
          pm.notes?.trim() ? `Notes: ${pm.notes.trim()}` : null,
        ]
          .filter((part): part is string => Boolean(part))
          .join('\n'),
        location: locationName,
      })
    }
  }

  for (const asset of assets) {
    const dueDates = buildCalibrationDueDatesInRange(
      asset,
      options.startDate,
      options.endDate
    )
    if (!dueDates.length) continue

    const locationName =
      locationNameById[asset.locationId] ?? `Location #${asset.locationId}`
    const assetLabel = assetLabelFor(asset)
    const recurrence = asFlexibleRecurrence(asset.calFreq)
    const recurrenceLabel = recurrence ?? asset.calFreq?.trim() ?? 'One-time'

    for (const dueDate of dueDates) {
      events.push({
        uid: `qualgen-cal-${asset.id}-${dueDate}@qualgen.local`,
        date: dueDate,
        summary: `Calibration Due - ${assetLabel}`,
        description: [
          `Type: Calibration`,
          `Asset: ${assetLabel}`,
          `Frequency: ${recurrenceLabel}`,
          asset.calibrationRange?.trim()
            ? `Calibration Range: ${asset.calibrationRange.trim()}`
            : null,
          asset.notes?.trim() ? `Notes: ${asset.notes.trim()}` : null,
        ]
          .filter((part): part is string => Boolean(part))
          .join('\n'),
        location: locationName,
      })
    }
  }

  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.summary.localeCompare(b.summary)
  )
}

const resolveFeedRange = (start?: string, end?: string) => {
  const defaultStartDate = new Date()
  defaultStartDate.setHours(0, 0, 0, 0)
  const defaultEndDate = addMonths(defaultStartDate, 36)

  const startDate = start ? parseIsoDate(start) : defaultStartDate
  const endDate = end ? parseIsoDate(end) : defaultEndDate

  if (!startDate || !endDate) return null
  if (startDate > endDate) return null
  return { startDate, endDate }
}

interface MsGraphConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  userId: string
  calendarId?: string
}

const msGraphCategory = 'Qualgen Sync'
const msGraphSubjectPrefix = ''

const getMsGraphConfig = (): MsGraphConfig | null => {
  const tenantId = process.env.MS_GRAPH_TENANT_ID?.trim()
  const clientId = process.env.MS_GRAPH_CLIENT_ID?.trim()
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET?.trim()
  const userId = process.env.MS_GRAPH_USER_ID?.trim()
  const calendarId = process.env.MS_GRAPH_CALENDAR_ID?.trim()

  if (!tenantId || !clientId || !clientSecret || !userId) return null
  return {
    tenantId,
    clientId,
    clientSecret,
    userId,
    calendarId: calendarId || undefined,
  }
}

const msGraphEventsEndpoint = (config: MsGraphConfig) => {
  const userId = encodeURIComponent(config.userId)
  if (config.calendarId) {
    return `https://graph.microsoft.com/v1.0/users/${userId}/calendars/${encodeURIComponent(config.calendarId)}/events`
  }
  return `https://graph.microsoft.com/v1.0/users/${userId}/calendar/events`
}

const fetchMsGraphToken = async (config: MsGraphConfig) => {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(
    config.tenantId
  )}/oauth2/v2.0/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Token request failed: ${response.status} ${message}`)
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error('Token response missing access_token')
  }
  return data.access_token
}

const msGraphRequest = async <T>(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Graph request failed: ${response.status} ${message}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

interface MsGraphEvent {
  id: string
  subject?: string
  categories?: string[]
}

interface MsGraphEventPage {
  value: MsGraphEvent[]
  '@odata.nextLink'?: string
}

const listManagedMsGraphEvents = async (
  accessToken: string,
  config: MsGraphConfig,
  startDate: Date,
  endDate: Date
) => {
  const startIso = `${toIsoDate(startDate)}T00:00:00Z`
  const endIso = `${toIsoDate(addDays(endDate, 1))}T00:00:00Z`

  const initialUrl = new URL(msGraphEventsEndpoint(config))
  initialUrl.searchParams.set(
    '$filter',
    `start/dateTime lt '${endIso}' and end/dateTime gt '${startIso}'`
  )
  initialUrl.searchParams.set('$select', 'id,subject,categories')
  initialUrl.searchParams.set('$top', '500')

  const managed: MsGraphEvent[] = []
  let nextUrl: string | undefined = initialUrl.toString()

  while (nextUrl) {
    const page: MsGraphEventPage = await msGraphRequest(
      accessToken,
      nextUrl
    )
    for (const event of page.value ?? []) {
      const categories = event.categories ?? []
      const managedByCategory = categories.includes(msGraphCategory)
      const managedBySubject = (event.subject ?? '').startsWith(msGraphSubjectPrefix)
      if (managedByCategory || managedBySubject) {
        managed.push(event)
      }
    }
    nextUrl = page['@odata.nextLink']
  }

  return managed
}

const graphDateTime = (isoDate: string) => `${isoDate}T00:00:00`

const syncMsGraphCalendar = async (options: {
  startDate: Date
  endDate: Date
  locationId?: number
  dryRun?: boolean
}) => {
  const config = getMsGraphConfig()
  if (!config) {
    throw new Error(
      'Microsoft Graph is not configured. Set MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, and MS_GRAPH_USER_ID.'
    )
  }

  const events = await buildCalendarFeedEvents({
    startDate: options.startDate,
    endDate: options.endDate,
    locationId: options.locationId,
  })

  const accessToken = await fetchMsGraphToken(config)
  const managedEvents = await listManagedMsGraphEvents(
    accessToken,
    config,
    options.startDate,
    options.endDate
  )

  if (!options.dryRun) {
    for (const event of managedEvents) {
      await msGraphRequest(
        accessToken,
        `${msGraphEventsEndpoint(config)}/${encodeURIComponent(event.id)}`,
        { method: 'DELETE' }
      )
    }

    for (const event of events) {
      const start = parseIsoDate(event.date)
      if (!start) continue
      const end = addDays(start, 1)

      await msGraphRequest(
        accessToken,
        msGraphEventsEndpoint(config),
        {
          method: 'POST',
          body: JSON.stringify({
            subject: `${msGraphSubjectPrefix}${event.summary}`,
            body: {
              contentType: 'text',
              content: [event.description, `Source UID: ${event.uid}`]
                .filter((part): part is string => Boolean(part))
                .join('\n\n'),
            },
            start: {
              dateTime: graphDateTime(event.date),
              timeZone: 'UTC',
            },
            end: {
              dateTime: graphDateTime(toIsoDate(end)),
              timeZone: 'UTC',
            },
            isAllDay: true,
            categories: [msGraphCategory],
            location: event.location
              ? { displayName: event.location }
              : undefined,
            transactionId: event.uid,
          }),
        }
      )
    }
  }

  return {
    dryRun: Boolean(options.dryRun),
    sourceEventCount: events.length,
    managedEventCount: managedEvents.length,
    deletedCount: options.dryRun ? 0 : managedEvents.length,
    createdCount: options.dryRun ? 0 : events.length,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/integrations/ms-graph/status', (_req, res) => {
  const config = getMsGraphConfig()
  res.json({
    configured: Boolean(config),
    userId: config?.userId ?? null,
    calendarId: config?.calendarId ?? null,
  })
})

app.post('/api/integrations/ms-graph/sync', async (req, res) => {
  const parsed = msGraphSyncSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const range = resolveFeedRange(parsed.data.start, parsed.data.end)
  if (!range) {
    res.status(400).json({ error: 'Invalid date range' })
    return
  }

  if (parsed.data.locationId) {
    const location = await Location.findByPk(parsed.data.locationId)
    if (!location) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
  }

  try {
    const result = await syncMsGraphCalendar({
      startDate: range.startDate,
      endDate: range.endDate,
      locationId: parsed.data.locationId,
      dryRun: parsed.data.dryRun,
    })
    res.json({
      range: {
        start: toIsoDate(range.startDate),
        end: toIsoDate(range.endDate),
        locationId: parsed.data.locationId ?? null,
      },
      ...result,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Microsoft Graph sync failed'
    res.status(500).json({ error: message })
  }
})

app.get('/api/locations', async (_req, res) => {
  const locations = await Location.findAll({ order: [['name', 'ASC']] })
  res.json(locations)
})

app.get('/api/calendar.ics', async (req, res) => {
  const parsed = pmComplianceReportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.format() })
    return
  }

  const range = resolveFeedRange(parsed.data.start, parsed.data.end)
  if (!range) {
    res.status(400).json({ error: 'Invalid date range' })
    return
  }

  let selectedLocation: Location | null = null
  if (parsed.data.locationId) {
    selectedLocation = await Location.findByPk(parsed.data.locationId)
    if (!selectedLocation) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
  }

  const events = await buildCalendarFeedEvents({
    startDate: range.startDate,
    endDate: range.endDate,
    locationId: parsed.data.locationId,
  })

  const calendarName = parsed.data.locationId
    ? `Qualgen ${selectedLocation?.name ?? `Location #${parsed.data.locationId}`} Calendar`
    : 'Qualgen Maintenance Calendar'

  const ics = buildIcsCalendar(calendarName, events)
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="qualgen-maintenance.ics"')
  res.send(ics)
})

app.get('/api/locations/:locationId/calendar.ics', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const parsed = calendarFeedQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.format() })
    return
  }

  const range = resolveFeedRange(parsed.data.start, parsed.data.end)
  if (!range) {
    res.status(400).json({ error: 'Invalid date range' })
    return
  }

  const location = await Location.findByPk(locationId)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  const events = await buildCalendarFeedEvents({
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
  })

  const fileSafeName = location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const ics = buildIcsCalendar(`Qualgen ${location.name} Calendar`, events)
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `inline; filename="qualgen-${fileSafeName || 'location'}-calendar.ics"`
  )
  res.send(ics)
})

app.get('/api/locations/:locationId/workorders', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const workOrders = await WorkOrder.findAll({
    where: { locationId },
    order: [['createdAt', 'DESC']],
  })
  res.json(workOrders)
})

app.get('/api/assets', async (_req, res) => {
  const assets = await Asset.findAll({
    order: [['createdAt', 'DESC']],
  })
  const enriched = await Promise.all(assets.map((asset) => withDerivedAssetFields(asset)))
  res.json(enriched)
})

app.get('/api/locations/:locationId/assets', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const assets = await Asset.findAll({
    where: { locationId },
    order: [['createdAt', 'DESC']],
  })
  const enriched = await Promise.all(assets.map((asset) => withDerivedAssetFields(asset)))
  res.json(enriched)
})

app.post('/api/locations/:locationId/assets', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const parsed = assetSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const location = await Location.findByPk(locationId)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  const asset = await Asset.create({
    locationId,
    ...parsed.data,
  } as any)
  res.status(201).json(await withDerivedAssetFields(asset))
})

app.delete('/api/assets/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid asset id' })
    return
  }

  try {
    const deleted = await sequelize.transaction(async (transaction) => {
      const linkedPms = await PreventativeMaintenance.findAll({
        where: { assetId: id },
        attributes: ['id'],
        transaction,
      })

      const pmIds = linkedPms.map((item) => item.id)
      if (pmIds.length > 0) {
        await PmCompletionHistory.destroy({
          where: {
            preventativeMaintenanceId: { [Op.in]: pmIds },
          },
          transaction,
        })
      }

      await PmCompletionHistory.destroy({
        where: { assetId: id },
        transaction,
      })

      await CalibrationCompletionHistory.destroy({
        where: { assetId: id },
        transaction,
      })

      await PreventativeMaintenance.destroy({
        where: { assetId: id },
        transaction,
      })

      return Asset.destroy({ where: { id }, transaction })
    })

    res.json({ deleted: deleted > 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete asset'
    res.status(500).json({ error: message })
  }
})

app.patch('/api/assets/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid asset id' })
    return
  }

  const parsed = assetSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const asset = await Asset.findByPk(id)
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' })
    return
  }

  await asset.update(parsed.data as any)
  res.json(await withDerivedAssetFields(asset))
})

app.post('/api/locations/:locationId/workorders', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const parsed = workOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const location = await Location.findByPk(locationId)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  const workOrder = await WorkOrder.create({
    locationId,
    ...parsed.data,
  } as any)
  res.status(201).json(workOrder)
})

app.delete('/api/workorders/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid work order id' })
    return
  }

  const deleted = await WorkOrder.destroy({ where: { id } })
  res.json({ deleted: deleted > 0 })
})

app.get('/api/locations/:locationId/preventative-maintenances', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const items = await PreventativeMaintenance.findAll({
    where: { locationId },
    order: [['createdAt', 'DESC']],
  })
  const enriched = await Promise.all(
    items.map((item) => withDerivedPreventativeFields(item))
  )
  res.json(enriched)
})

app.post('/api/locations/:locationId/preventative-maintenances', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const parsed = preventativeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const location = await Location.findByPk(locationId)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  const asset = await Asset.findOne({
    where: {
      id: parsed.data.assetId,
      locationId,
    },
  })
  if (!asset) {
    res.status(400).json({ error: 'Asset not found for this location' })
    return
  }

  const item = await PreventativeMaintenance.create({
    locationId,
    assetId: parsed.data.assetId,
    recurrence: parsed.data.recurrence,
    frequency: parsed.data.recurrence,
    pmFreq: parsed.data.pmFreq,
    lastPm: (await getLatestCompletedPmDateForAsset(asset.id)) ?? asset.lastPm ?? null,
    pm: parsed.data.pm,
    revalidationCertification: parsed.data.revalidationCertification,
    scheduleAnchor: parsed.data.nextDue,
    title: parsed.data.title,
    lastCompleted: parsed.data.lastCompleted,
    nextDue: parsed.data.nextDue,
    notes: parsed.data.notes,
  } as any)
  res.status(201).json(await withDerivedPreventativeFields(item))
})

app.delete('/api/preventative-maintenances/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid preventative maintenance id' })
    return
  }

  try {
    const deleted = await sequelize.transaction(async (transaction) => {
      const pm = await PreventativeMaintenance.findByPk(id, { transaction })
      const linkedAssetId = pm?.assetId ?? null

      await PmCompletionHistory.destroy({
        where: { preventativeMaintenanceId: id },
        transaction,
      })
      const deletedCount = await PreventativeMaintenance.destroy({
        where: { id },
        transaction,
      })

      if (linkedAssetId) {
        await syncAssetLastPmFromHistory(linkedAssetId, transaction)
      }

      return deletedCount
    })

    res.json({ deleted: deleted > 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete PM'
    res.status(500).json({ error: message })
  }
})

app.get('/api/preventative-maintenances/:id/completion-history', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid preventative maintenance id' })
    return
  }

  const pm = await PreventativeMaintenance.findByPk(id)
  if (!pm) {
    res.status(404).json({ error: 'Preventative maintenance not found' })
    return
  }

  const history = await PmCompletionHistory.findAll({
    where: { preventativeMaintenanceId: id },
    order: [['dueDate', 'DESC']],
  })
  res.json(history)
})

app.post('/api/preventative-maintenances/:id/completion-history', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid preventative maintenance id' })
    return
  }

  const parsed = completionHistorySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const pm = await PreventativeMaintenance.findByPk(id)
  if (!pm) {
    res.status(404).json({ error: 'Preventative maintenance not found' })
    return
  }

  const dueDate = parsed.data.dueDate
  const dueDateObj = parseIsoDate(dueDate)
  if (!dueDateObj) {
    res.status(400).json({ error: 'Invalid due date' })
    return
  }

  const completedAt = parsed.data.completedAt ?? todayIso()
  const completedAtObj = parseIsoDate(completedAt)
  if (!completedAtObj) {
    res.status(400).json({ error: 'Invalid completed date' })
    return
  }

  const existing = await PmCompletionHistory.findOne({
    where: {
      preventativeMaintenanceId: id,
      dueDate,
    },
  })

  let history: PmCompletionHistory
  if (existing) {
    history = await existing.update({
      completedAt,
      notes: parsed.data.notes ?? existing.notes ?? null,
      locationId: pm.locationId,
      assetId: pm.assetId ?? null,
    } as any)
  } else {
    history = await PmCompletionHistory.create({
      preventativeMaintenanceId: id,
      locationId: pm.locationId,
      assetId: pm.assetId ?? null,
      dueDate,
      completedAt,
      notes: parsed.data.notes ?? null,
    } as any)
  }

  const recurrence = asRecurrence(pm.recurrence ?? pm.frequency)
  if (recurrence) {
    const nextDue = toIsoDate(nextRecurringDate(dueDateObj, recurrence))
    const currentNextDueObj = pm.nextDue ? parseIsoDate(pm.nextDue) : null
    if (!currentNextDueObj || currentNextDueObj <= dueDateObj) {
      pm.nextDue = nextDue
    }
  }

  pm.lastCompleted = completedAt
  pm.lastPm = await getLatestCompletedPmDateForPreventative(id)
  if (!pm.scheduleAnchor && pm.nextDue) {
    pm.scheduleAnchor = pm.nextDue
  }
  await pm.save()

  if (pm.assetId) {
    await syncAssetLastPmFromHistory(pm.assetId)
  }

  res.status(201).json({
    history,
    preventativeMaintenance: await withDerivedPreventativeFields(pm),
  })
})

app.get('/api/assets/:id/calibration-history', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid asset id' })
    return
  }

  const asset = await Asset.findByPk(id)
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' })
    return
  }

  const history = await CalibrationCompletionHistory.findAll({
    where: { assetId: id },
    order: [['dueDate', 'DESC']],
  })
  res.json(history)
})

app.post('/api/assets/:id/calibration-history', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid asset id' })
    return
  }

  const parsed = calibrationCompletionHistorySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const asset = await Asset.findByPk(id)
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' })
    return
  }

  const dueDate = parsed.data.dueDate
  const dueDateObj = parseIsoDate(dueDate)
  if (!dueDateObj) {
    res.status(400).json({ error: 'Invalid due date' })
    return
  }

  const completedAt = parsed.data.completedAt ?? todayIso()
  const completedAtObj = parseIsoDate(completedAt)
  if (!completedAtObj) {
    res.status(400).json({ error: 'Invalid completed date' })
    return
  }

  const existing = await CalibrationCompletionHistory.findOne({
    where: {
      assetId: id,
      dueDate,
    },
  })

  let history: CalibrationCompletionHistory
  if (existing) {
    history = await existing.update({
      completedAt,
      notes: parsed.data.notes ?? existing.notes ?? null,
      locationId: asset.locationId,
    } as any)
  } else {
    history = await CalibrationCompletionHistory.create({
      assetId: id,
      locationId: asset.locationId,
      dueDate,
      completedAt,
      notes: parsed.data.notes ?? null,
    } as any)
  }

  const recurrence = asFlexibleRecurrence(asset.calFreq)
  if (recurrence) {
    const nextDue = toIsoDate(nextRecurringDate(dueDateObj, recurrence))
    const currentCalDueObj = asset.calDue ? parseIsoDate(asset.calDue) : null
    if (!currentCalDueObj || currentCalDueObj <= dueDateObj) {
      asset.calDue = nextDue
    }
  }

  await asset.save()
  await syncAssetLastCalibrationFromHistory(id)

  const refreshedAsset = (await Asset.findByPk(id)) ?? asset

  res.status(201).json({
    history,
    asset: await withDerivedAssetFields(refreshedAsset),
  })
})

app.delete('/api/calibration-history/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid calibration history id' })
    return
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const entry = await CalibrationCompletionHistory.findByPk(id, { transaction })
      if (!entry) {
        return { deleted: false, asset: null as Asset | null }
      }

      const assetId = entry.assetId
      await CalibrationCompletionHistory.destroy({
        where: { id },
        transaction,
      })
      await syncAssetLastCalibrationFromHistory(assetId, transaction)
      const asset = await Asset.findByPk(assetId, { transaction })
      return { deleted: true, asset }
    })

    if (!result.deleted) {
      res.status(404).json({ error: 'Calibration history entry not found' })
      return
    }

    res.json({
      deleted: true,
      asset: result.asset ? await withDerivedAssetFields(result.asset) : null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete calibration history entry'
    res.status(500).json({ error: message })
  }
})

app.get('/api/reports/pm-compliance', async (req, res) => {
  const parsed = pmComplianceReportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.format() })
    return
  }

  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const start = parsed.data.start ?? toIsoDate(defaultStart)
  const end = parsed.data.end ?? toIsoDate(defaultEnd)

  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Invalid date range' })
    return
  }
  if (startDate > endDate) {
    res.status(400).json({ error: 'start must be before or equal to end' })
    return
  }

  const recordWhere = parsed.data.locationId
    ? { locationId: parsed.data.locationId }
    : undefined

  const [pms, assets] = await Promise.all([
    PreventativeMaintenance.findAll({
      where: recordWhere,
      order: [['id', 'ASC']],
    }),
    Asset.findAll({
      where: recordWhere,
      order: [['id', 'ASC']],
    }),
  ])

  if (!pms.length && !assets.length) {
    res.json({
      range: { start, end, locationId: parsed.data.locationId ?? null },
      summary: {
        total: 0,
        completedOnTime: 0,
        completedLate: 0,
        missed: 0,
        scheduled: 0,
      },
      rows: [],
    })
    return
  }

  const pmIds = pms.map((pm) => pm.id)
  const calibrationAssets = assets.filter((asset) => Boolean(asset.calDue?.trim()))
  const calibrationAssetIds = calibrationAssets.map((asset) => asset.id)
  const locationIds = Array.from(
    new Set([
      ...pms.map((pm) => pm.locationId),
      ...assets.map((asset) => asset.locationId),
    ])
  )

  const [locations, pmHistory, calibrationHistory] = await Promise.all([
    Location.findAll({ where: { id: { [Op.in]: locationIds } as any } }),
    pmIds.length
      ? PmCompletionHistory.findAll({
          where: {
            preventativeMaintenanceId: { [Op.in]: pmIds } as any,
            dueDate: { [Op.gte]: start, [Op.lte]: end } as any,
          },
          order: [['dueDate', 'ASC']],
        })
      : Promise.resolve([]),
    calibrationAssetIds.length
      ? CalibrationCompletionHistory.findAll({
          where: {
            assetId: { [Op.in]: calibrationAssetIds } as any,
            dueDate: { [Op.gte]: start, [Op.lte]: end } as any,
          },
          order: [['dueDate', 'ASC']],
        })
      : Promise.resolve([]),
  ])

  const locationNameById = Object.fromEntries(locations.map((location) => [location.id, location.name]))
  const assetLabelById = Object.fromEntries(
    assets.map((asset) => {
      const label = [asset.aid, asset.manufacturerModel, asset.equipmentDescription]
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length)
        .join(' · ')
      return [asset.id, label || `Asset #${asset.id}`]
    })
  )
  const pmHistoryByKey = Object.fromEntries(
    pmHistory.map((item) => [`${item.preventativeMaintenanceId}|${item.dueDate}`, item])
  )
  const calibrationHistoryByKey = Object.fromEntries(
    calibrationHistory.map((item) => [`${item.assetId}|${item.dueDate}`, item])
  )

  const today = todayIso()
  const pmRows = pms.flatMap((pm) => {
    const dueDates = buildDueDatesInRange(pm, startDate, endDate)
    return dueDates.map((dueDate) => {
      const historyEntry = pmHistoryByKey[`${pm.id}|${dueDate}`]
      const completedAt = historyEntry?.completedAt ?? null
      const completed = Boolean(completedAt)
      const late = completed ? completedAt! > dueDate : false
      const status = completed
        ? late
          ? 'completed-late'
          : 'completed-on-time'
        : dueDate < today
          ? 'missed'
          : 'scheduled'

      return {
        reportKey: `pm-${pm.id}-${dueDate}`,
        sourceType: 'pm',
        sourceId: pm.id,
        preventativeMaintenanceId: pm.id,
        title: pm.title ?? null,
        recurrence: pm.recurrence ?? pm.frequency ?? null,
        dueDate,
        completedAt,
        status,
        happened: completed,
        locationId: pm.locationId,
        locationName: locationNameById[pm.locationId] ?? `Location #${pm.locationId}`,
        assetId: pm.assetId ?? null,
        assetLabel: pm.assetId
          ? assetLabelById[pm.assetId] ?? `Asset #${pm.assetId}`
          : 'Unassigned Asset',
        notes: historyEntry?.notes ?? null,
      }
    })
  })

  const calibrationRows = calibrationAssets.flatMap((asset) => {
    const dueDates = buildCalibrationDueDatesInRange(asset, startDate, endDate)
    return dueDates.map((dueDate) => {
      const historyEntry = calibrationHistoryByKey[`${asset.id}|${dueDate}`]
      const completedAt = historyEntry?.completedAt ?? null
      const completed = Boolean(completedAt)
      const late = completed ? completedAt! > dueDate : false
      const status = completed
        ? late
          ? 'completed-late'
          : 'completed-on-time'
        : dueDate < today
          ? 'missed'
          : 'scheduled'

      return {
        reportKey: `calibration-${asset.id}-${dueDate}`,
        sourceType: 'calibration',
        sourceId: asset.id,
        preventativeMaintenanceId: null,
        title: 'Calibration Due',
        recurrence: asset.calFreq ?? null,
        dueDate,
        completedAt,
        status,
        happened: completed,
        locationId: asset.locationId,
        locationName: locationNameById[asset.locationId] ?? `Location #${asset.locationId}`,
        assetId: asset.id,
        assetLabel: assetLabelById[asset.id] ?? `Asset #${asset.id}`,
        notes: historyEntry?.notes ?? null,
      }
    })
  })

  const rows = [...pmRows, ...calibrationRows].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.locationName.localeCompare(b.locationName) ||
      a.sourceType.localeCompare(b.sourceType) ||
      a.assetLabel.localeCompare(b.assetLabel)
  )

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1
      if (row.status === 'completed-on-time') acc.completedOnTime += 1
      else if (row.status === 'completed-late') acc.completedLate += 1
      else if (row.status === 'missed') acc.missed += 1
      else acc.scheduled += 1
      return acc
    },
    {
      total: 0,
      completedOnTime: 0,
      completedLate: 0,
      missed: 0,
      scheduled: 0,
    }
  )

  res.json({
    range: { start, end, locationId: parsed.data.locationId ?? null },
    summary,
    rows,
  })
})

app.get('/api/locations/:locationId/notes', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const notes = await LocationNote.findAll({
    where: { locationId },
    order: [['createdAt', 'DESC']],
  })
  res.json(notes)
})

app.post('/api/locations/:locationId/notes', async (req, res) => {
  const locationId = Number(req.params.locationId)
  if (Number.isNaN(locationId)) {
    res.status(400).json({ error: 'Invalid location id' })
    return
  }

  const parsed = noteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const location = await Location.findByPk(locationId)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  const note = await LocationNote.create({
    locationId,
    content: parsed.data.content,
  } as any)
  res.status(201).json(note)
})

app.delete('/api/notes/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid note id' })
    return
  }

  const deleted = await LocationNote.destroy({ where: { id } })
  res.json({ deleted: deleted > 0 })
})

app.get('/api/contacts', async (_req, res) => {
  const contacts = await Contact.findAll({
    order: [['createdAt', 'DESC']],
  })
  res.json(contacts)
})

app.post('/api/contacts', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const contact = await Contact.create(parsed.data as any)
  res.status(201).json(contact)
})

app.patch('/api/contacts/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid contact id' })
    return
  }

  const parsed = contactSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() })
    return
  }

  const contact = await Contact.findByPk(id)
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' })
    return
  }

  await contact.update(parsed.data as any)
  res.json(contact)
})

app.delete('/api/contacts/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid contact id' })
    return
  }

  const deleted = await Contact.destroy({ where: { id } })
  res.json({ deleted: deleted > 0 })
})

const port = Number(process.env.PORT) || 3001

initDb()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Qualgen WO API listening on port ${port}`)
    })
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error)
    process.exit(1)
  })
