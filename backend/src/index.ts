import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { initDb } from './db'
import { Location } from './models/Location'
import { WorkOrder } from './models/WorkOrder'
import { Asset } from './models/Asset'
import { PreventativeMaintenance } from './models/PreventativeMaintenance'
import { LocationNote } from './models/LocationNote'

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

const preventativeSchema = z.object({
  title: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  lastCompleted: z.string().optional().nullable(),
  nextDue: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const noteSchema = z.object({
  content: z.string().min(1),
})

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

  const item = await PreventativeMaintenance.create({
    locationId,
    ...parsed.data,
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
