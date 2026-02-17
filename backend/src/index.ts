import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { Op } from 'sequelize'
import { initDb } from './db'
import { Location } from './models/Location'
import { WorkOrder } from './models/WorkOrder'
import { Asset } from './models/Asset'
import { PreventativeMaintenance } from './models/PreventativeMaintenance'
import { LocationNote } from './models/LocationNote'
import { PmCompletionHistory } from './models/PmCompletionHistory'
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

const pmComplianceReportQuerySchema = z.object({
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
  locationId: z.coerce.number().int().positive().optional(),
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/locations', async (_req, res) => {
  const locations = await Location.findAll({ order: [['name', 'ASC']] })
  res.json(locations)
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
  res.json(assets)
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
  res.json(assets)
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
  res.status(201).json(asset)
})

app.delete('/api/assets/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid asset id' })
    return
  }

  const deleted = await Asset.destroy({ where: { id } })
  res.json({ deleted: deleted > 0 })
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
  res.json(asset)
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
  res.json(items)
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
    lastPm: parsed.data.lastPm,
    pm: parsed.data.pm,
    revalidationCertification: parsed.data.revalidationCertification,
    scheduleAnchor: parsed.data.nextDue,
    title: parsed.data.title,
    lastCompleted: parsed.data.lastCompleted,
    nextDue: parsed.data.nextDue,
    notes: parsed.data.notes,
  } as any)
  res.status(201).json(item)
})

app.delete('/api/preventative-maintenances/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid preventative maintenance id' })
    return
  }

  const deleted = await PreventativeMaintenance.destroy({ where: { id } })
  res.json({ deleted: deleted > 0 })
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
  if (!pm.scheduleAnchor && pm.nextDue) {
    pm.scheduleAnchor = pm.nextDue
  }
  await pm.save()

  res.status(201).json({
    history,
    preventativeMaintenance: pm,
  })
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

  const pmWhere = parsed.data.locationId
    ? { locationId: parsed.data.locationId }
    : undefined

  const pms = await PreventativeMaintenance.findAll({
    where: pmWhere,
    order: [['id', 'ASC']],
  })

  if (!pms.length) {
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
  const locationIds = Array.from(new Set(pms.map((pm) => pm.locationId)))
  const assetIds = Array.from(
    new Set(pms.map((pm) => pm.assetId).filter((id): id is number => Number.isInteger(id)))
  )

  const [locations, assets, history] = await Promise.all([
    Location.findAll({ where: { id: { [Op.in]: locationIds } as any } }),
    assetIds.length
      ? Asset.findAll({ where: { id: { [Op.in]: assetIds } as any } })
      : Promise.resolve([]),
    PmCompletionHistory.findAll({
      where: {
        preventativeMaintenanceId: { [Op.in]: pmIds } as any,
        dueDate: { [Op.gte]: start, [Op.lte]: end } as any,
      },
      order: [['dueDate', 'ASC']],
    }),
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
  const historyByKey = Object.fromEntries(
    history.map((item) => [`${item.preventativeMaintenanceId}|${item.dueDate}`, item])
  )

  const today = todayIso()
  const rows = pms.flatMap((pm) => {
    const dueDates = buildDueDatesInRange(pm, startDate, endDate)
    return dueDates.map((dueDate) => {
      const historyEntry = historyByKey[`${pm.id}|${dueDate}`]
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
