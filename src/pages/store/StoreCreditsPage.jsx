import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ToastMessage } from '../../context/ToastContext'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import FrenchScheduleTable from '../../components/FrenchScheduleTable'
import PageBanner from '../../components/PageBanner'
import ProductPicker from '../../components/ProductPicker'

const DEFAULT_TEA = 20
const DEFAULT_TEA_MORATORIA = 40
const MAX_GRACE_PERIODS = 3
const PERIODS_PER_MONTH = 2
const SIMULATION_DELAY_MS = 450
const SIMULATION_RETRIES = 4
const SIMULATION_RETRY_MS = 2000

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function date(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-PE') : '—'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function asPercent(value) {
  return Number((Number(value || 0) * 100).toFixed(4))
}

function asDecimal(value) {
  return Number((Number(value) / 100).toFixed(8))
}

function percentLabel(value) {
  return `${asPercent(value)} %`
}

function hasActiveCredit(record) {
  return record.plans.some(plan => plan.status === 'ACTIVE')
}

function isEligibleForCredit(record, policy) {
  return Boolean(policy) && record.client.active === true && !hasActiveCredit(record)
}

function maxPeriodsFor(policy) {
  return Math.max(1, Number(policy?.plazoMaximoMeses || 4)) * PERIODS_PER_MONTH
}

function periodsLabel(periods) {
  const wholeMonths = Math.floor(periods / PERIODS_PER_MONTH)
  const halfMonth = periods % PERIODS_PER_MONTH === 1
  let duration
  if (wholeMonths === 0) duration = 'medio mes'
  else if (halfMonth) duration = `${wholeMonths} ${wholeMonths === 1 ? 'mes' : 'meses'} y medio`
  else duration = `${wholeMonths} ${wholeMonths === 1 ? 'mes' : 'meses'}`
  return `${periods} ${periods === 1 ? 'periodo' : 'periodos'} de 15 días (${duration})`
}

function friendlyCreditError(error, policy, client, principal) {
  const original = String(error?.message || error || '')
  const message = original.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  if (message.includes('fuera del rango permitido') && message.includes('tea')) {
    return policy
      ? `La TEA del crédito debe estar entre ${percentLabel(policy.teaMinima)} y ${percentLabel(policy.teaMaxima)}, según la política de la tienda.`
      : 'La TEA del crédito no está dentro de lo permitido por la tienda.'
  }
  if (message.includes('fuera del rango permitido')) {
    const minimum = Number(policy?.capitalMinimo)
    const maximum = Number(policy?.capitalMaximo)
    if (Number.isFinite(principal) && policy && principal < minimum) {
      return `El monto a financiar es ${money(principal)}. Para pedir un crédito necesitas al menos ${money(minimum)}. Agrega más productos o aumenta las cantidades.`
    }
    if (Number.isFinite(principal) && policy && principal > maximum) {
      return `El monto a financiar es ${money(principal)}, pero el máximo permitido es ${money(maximum)}. Reduce la cantidad de productos.`
    }
    return policy
      ? `El monto financiado debe estar entre ${money(minimum)} y ${money(maximum)}. Revisa los productos y sus cantidades.`
      : 'El monto del crédito no está dentro de lo permitido por la tienda. Revisa la política de crédito.'
  }
  if (message.includes('moratoria debe ser mayor')) {
    return policy
      ? `La TEA moratoria debe ser mayor a ${percentLabel(policy.teaMaxima)}, la TEA máxima permitida por la tienda.`
      : 'La TEA moratoria debe ser mayor a la TEA máxima permitida por la tienda.'
  }
  if (message.includes('no otorga periodos de gracia')) {
    return 'La política de la tienda no permite periodos de gracia. Elige 0 periodos de gracia.'
  }
  if (message.includes('periodos de gracia')) {
    return 'Los periodos de gracia deben estar entre 0 y 3 y ser menos que el total de periodos del crédito.'
  }
  if (message.includes('limite de credito')) {
    return client
      ? `Este cliente tiene un límite de crédito de ${money(client.limiteCredito)}. Reduce el monto a financiar para continuar.`
      : 'El monto solicitado supera el límite de crédito del cliente. Reduce el importe para continuar.'
  }
  if (message.includes('plazo maximo') || message.includes('numero de periodos')) {
    return policy
      ? `La política de la tienda permite como máximo ${maxPeriodsFor(policy)} periodos de 15 días (${policy.plazoMaximoMeses} meses). Elige un plazo más corto.`
      : 'El plazo seleccionado supera el máximo permitido por la tienda. Elige menos periodos.'
  }
  if (message.includes('credito en cuotas activo')) {
    return 'Este cliente ya tiene un crédito activo. Debe terminar de pagarlo antes de solicitar otro.'
  }
  if (message.includes('cronograma anterior')) {
    return 'Esa cuota pertenece a un cronograma anterior del crédito y ya no puede pagarse.'
  }
  if (message.includes('ya fue pagada')) {
    return 'Esta cuota ya estaba registrada como pagada.'
  }
  if (message.includes('primero se debe pagar')) {
    return 'Primero marca como pagada la cuota anterior.'
  }
  if (message.includes('inactivo') && message.includes('producto')) {
    return 'Uno de los productos seleccionados ya no está activo. Quítalo y elige otro.'
  }
  if (message.includes('inactivo') || message.includes('no se encuentra asociado')) {
    return 'Este cliente no está habilitado para comprar en esta tienda. Selecciona otro cliente.'
  }
  if (message.includes('no permite pago en cuotas')) {
    return 'Uno de los productos seleccionados no está disponible para pagos en cuotas. Elige otro producto.'
  }
  if (message.includes('producto no puede repetirse')) {
    return 'Agregaste el mismo producto más de una vez. Cambia su cantidad en lugar de repetirlo.'
  }
  if (message.includes('no pertenece a esta tienda')) {
    return 'Ese registro no pertenece a esta tienda. Actualiza la página e inténtalo nuevamente.'
  }
  if (message.includes('politica de credito')) {
    return 'Esta tienda todavía no tiene una política de crédito configurada. Configúrala antes de continuar.'
  }
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network request failed')) {
    return 'No pudimos conectarnos con Dayudita. Verifica que la aplicación esté funcionando e inténtalo nuevamente.'
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('sesion')) {
    return 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.'
  }
  if (message.includes('403') || message.includes('forbidden') || message.includes('access denied') || message.includes('permisos')) {
    return 'Tu cuenta no tiene permiso para realizar esta operación.'
  }
  if (message.includes('formato valido') || message.includes('invalid json')) {
    return 'Revisa los datos ingresados e inténtalo nuevamente.'
  }
  return original && !/(exception|stack|java\.|org\.|nullpointer|500)/i.test(original)
    ? original
    : 'No pudimos completar la operación. Revisa los datos e inténtalo nuevamente.'
}

function emptyCredit() {
  return {
    clientId: '',
    purchaseDate: today(),
    paymentMode: 'INSTALLMENTS',
    numeroPeriodos: 8,
    teaPactada: DEFAULT_TEA,
    teaMoratoriaPactada: DEFAULT_TEA_MORATORIA,
    periodosGracia: 0,
    items: []
  }
}

function formFromPlan(plan) {
  return {
    clientId: String(plan.clientId),
    purchaseDate: plan.purchaseDate || today(),
    paymentMode: 'INSTALLMENTS',
    numeroPeriodos: plan.installmentCount,
    teaPactada: asPercent(plan.teaPactada),
    teaMoratoriaPactada: asPercent(plan.teaMoratoriaPactada),
    periodosGracia: plan.periodosGracia ?? 0,
    items: (plan.items || []).map(item => ({ productId: String(item.productId), quantity: item.quantity }))
  }
}

const FIELD_LABELS = {
  purchaseDate: 'fecha de compra',
  teaPactada: 'TEA',
  teaMoratoriaPactada: 'TEA moratoria',
  numeroPeriodos: 'duración',
  periodosGracia: 'periodos de gracia',
  items: 'productos'
}

function changedFields(form, original) {
  const a = JSON.parse(normalizeForm(form))
  const b = JSON.parse(normalizeForm(original))
  return Object.keys(FIELD_LABELS)
    .filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .map(key => FIELD_LABELS[key])
}

function normalizeForm(form) {
  return JSON.stringify({
    purchaseDate: form.purchaseDate,
    numeroPeriodos: Number(form.numeroPeriodos),
    teaPactada: Number(form.teaPactada),
    teaMoratoriaPactada: Number(form.teaMoratoriaPactada),
    periodosGracia: Number(form.periodosGracia),
    items: form.items.map(item => [String(item.productId), Number(item.quantity)])
  })
}

function buildTerms(form, policy) {
  const totalPeriods = Number(form.numeroPeriodos)
  const maximumPeriods = maxPeriodsFor(policy)
  if (!Number.isInteger(totalPeriods) || totalPeriods < 1 || totalPeriods > maximumPeriods) {
    throw new Error(`Puedes elegir un plazo de 1 a ${maximumPeriods} periodos de 15 días.`)
  }

  const tea = Number(form.teaPactada)
  if (form.teaPactada === '' || !Number.isFinite(tea) || tea <= 0) {
    throw new Error('Indica la TEA del crédito.')
  }
  if (policy && (asDecimal(tea) < Number(policy.teaMinima) || asDecimal(tea) > Number(policy.teaMaxima))) {
    throw new Error(`La TEA del crédito debe estar entre ${percentLabel(policy.teaMinima)} y ${percentLabel(policy.teaMaxima)}.`)
  }

  const moratory = Number(form.teaMoratoriaPactada)
  if (form.teaMoratoriaPactada === '' || !Number.isFinite(moratory)) {
    throw new Error('Indica la TEA moratoria del crédito.')
  }
  if (moratory <= 0) {
    throw new Error('La TEA moratoria debe ser mayor a 0.')
  }
  if (policy && moratory <= asPercent(policy.teaMaxima)) {
    throw new Error(`La TEA moratoria debe ser mayor a ${percentLabel(policy.teaMaxima)}, la TEA máxima permitida por la tienda.`)
  }

  const grace = Number(form.periodosGracia)
  if (!Number.isInteger(grace) || grace < 0 || grace > MAX_GRACE_PERIODS || grace >= totalPeriods) {
    throw new Error('Los periodos de gracia deben estar entre 0 y 3 y ser menos que el total de periodos.')
  }

  return {
    numeroPeriodos: totalPeriods,
    teaPactada: asDecimal(tea),
    teaMoratoriaPactada: asDecimal(moratory),
    periodosGracia: grace
  }
}

function buildItems(items, availableProducts) {
  if (items.length === 0) {
    throw new Error('Agrega al menos un producto para continuar.')
  }
  const usedIds = new Set()
  return items.map(item => {
    const product = availableProducts.find(candidate => String(candidate.id) === String(item.productId))
    if (!product) {
      throw new Error('Uno de los productos seleccionados no está disponible para esta forma de pago. Quítalo para continuar.')
    }
    if (usedIds.has(String(product.id))) {
      throw new Error(`${product.name} ya está en la lista. Si necesitas más unidades, aumenta su cantidad.`)
    }
    usedIds.add(String(product.id))
    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Indica una cantidad de al menos 1 unidad para ${product.name}.`)
    }
    return { productId: product.id, quantity }
  })
}

function CreditTermsFields({ form, onChange, policy }) {
  const maximumPeriods = maxPeriodsFor(policy)
  const totalPeriods = Number(form.numeroPeriodos)
  const graceAllowed = policy ? policy.otorgaGracia !== false : true
  const maxGrace = graceAllowed ? Math.min(MAX_GRACE_PERIODS, Math.max(0, totalPeriods - 1)) : 0
  const graceOptions = Array.from({ length: maxGrace + 1 }, (_, value) => value)

  return (
    <>
      <label>
        TEA del crédito (%)
        <input
          type="number"
          min="0"
          step="any"
          value={form.teaPactada}
          onChange={event => onChange({ teaPactada: event.target.value })}
          required
        />
        {policy && (
          <small className="field-hint">Rango de la tienda: {percentLabel(policy.teaMinima)} a {percentLabel(policy.teaMaxima)}.</small>
        )}
      </label>
      <label>
        TEA moratoria (%)
        <input
          type="number"
          min="0"
          step="any"
          value={form.teaMoratoriaPactada}
          onChange={event => onChange({ teaMoratoriaPactada: event.target.value })}
          required
        />
        {policy && (
          <small className="field-hint">Debe ser mayor a la TEA máxima de la tienda ({percentLabel(policy.teaMaxima)}).</small>
        )}
      </label>
      <label>
        Duración
        <select
          value={form.numeroPeriodos}
          onChange={event => {
            const numeroPeriodos = Number(event.target.value)
            const limit = Math.min(MAX_GRACE_PERIODS, numeroPeriodos - 1)
            onChange({
              numeroPeriodos,
              periodosGracia: Math.min(Number(form.periodosGracia), Math.max(0, limit))
            })
          }}
        >
          {Array.from({ length: maximumPeriods }, (_, index) => index + 1).map(value => (
            <option key={value} value={value}>
              {periodsLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Periodos de gracia total
        <select
          value={form.periodosGracia}
          onChange={event => onChange({ periodosGracia: Number(event.target.value) })}
          disabled={!graceAllowed}
        >
          {graceOptions.map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {!graceAllowed && (
          <small className="field-hint">La política de la tienda no otorga periodos de gracia.</small>
        )}
      </label>
    </>
  )
}

function useAutoSimulation(enabled, deps, run) {
  const [state, setState] = useState({ plan: null, error: '', loading: false })
  const requestRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState({ plan: null, error: '', loading: false })
      return undefined
    }

    const requestId = ++requestRef.current
    let request
    try {
      request = run()
    } catch (validationError) {
      setState({ plan: null, error: validationError.message, loading: false })
      return undefined
    }

    setState(current => ({ ...current, loading: true, error: '' }))
    let retryTimer
    const attempt = async (retriesLeft) => {
      try {
        const plan = await request()
        if (requestId === requestRef.current) setState({ plan, error: '', loading: false })
      } catch (simulationError) {
        if (requestId !== requestRef.current) return
        if (simulationError.network && retriesLeft > 0) {
          retryTimer = setTimeout(() => attempt(retriesLeft - 1), SIMULATION_RETRY_MS)
          return
        }
        setState({ plan: null, error: simulationError.message, loading: false })
      }
    }
    const timer = setTimeout(() => attempt(SIMULATION_RETRIES), SIMULATION_DELAY_MS)

    return () => {
      clearTimeout(timer)
      clearTimeout(retryTimer)
    }
  }, [enabled, ...deps])

  return state
}

export default function StoreCreditsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { planId } = useParams()
  const [records, setRecords] = useState([])
  const [products, setProducts] = useState([])
  const [creditPolicy, setCreditPolicy] = useState(null)
  const [openingCredit, setOpeningCredit] = useState(false)
  const [search, setSearch] = useState('')
  const [paidPurchase, setPaidPurchase] = useState(null)
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditForm, setCreditForm] = useState(emptyCredit)
  const [paymentDate, setPaymentDate] = useState(today())
  const [payingInstallment, setPayingInstallment] = useState(null)
  const [payAnchor, setPayAnchor] = useState(null)
  const [paying, setPaying] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [productsEditor, setProductsEditor] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [notice, setNotice] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [clientData, productData, policyData] = await Promise.all([
        api.getStoreClients(user.storeId),
        api.getStoreProducts(user.storeId),
        api.getStoreCreditPolicy(user.storeId).catch(() => null)
      ])

      const financeData = await Promise.all(
        clientData.map(async client => {
          const plans = await api.getStoreCreditPlans(user.storeId, client.id)
          return { client, plans }
        })
      )

      setProducts(productData || [])
      setCreditPolicy(policyData)
      setRecords(financeData)
      return { financeData, policyData }
    } catch (loadError) {
      setError(friendlyCreditError(loadError))
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const allRows = useMemo(() => records.flatMap(record =>
    record.plans.map(plan => ({ client: record.client, data: plan }))
  ), [records])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allRows.filter(row => {
      if (!query) return true
      const clientText = `${row.client.firstName} ${row.client.lastName} ${row.client.documentNumber}`
      return clientText.toLowerCase().includes(query)
    })
  }, [allRows, search])

  const selected = useMemo(
    () => (planId ? allRows.find(row => String(row.data.id) === planId) || null : null),
    [planId, allRows]
  )

  useEffect(() => {
    setPayingInstallment(null)
    setDetailError('')
    setProductsEditor(null)
    setShowHistory(false)
  }, [planId])

  useEffect(() => {
    setEditForm(selected ? formFromPlan(selected.data) : null)
  }, [selected?.data])

  const isInstallments = creditForm.paymentMode === 'INSTALLMENTS'
  const installmentProducts = products.filter(product => product.active !== false && product.allowsInstallments === true)
  const availableProducts = isInstallments
    ? installmentProducts
    : products.filter(product => product.active !== false)
  const eligibleClients = records.filter(record => (
    isInstallments ? isEligibleForCredit(record, creditPolicy) : record.client.active === true
  ))
  const createClient = eligibleClients.find(record => String(record.client.id) === String(creditForm.clientId))?.client

  function updateCreditForm(changes) {
    setCreditForm(current => ({ ...current, ...changes }))
    setError('')
  }

  async function openCreditModal() {
    if (openingCredit) return
    setOpeningCredit(true)
    const loaded = await loadData()
    setOpeningCredit(false)
    if (!loaded) return
    const { financeData: latestRecords, policyData } = loaded
    if (planId) navigate('/store/credits')

    const firstClient = latestRecords.find(record => isEligibleForCredit(record, policyData))?.client
    setCreditForm({ ...emptyCredit(), clientId: firstClient ? String(firstClient.id) : '' })
    setError('')
    setSuccess('')
    setShowCreditModal(true)
  }

  function buildPurchasePayload() {
    if (!creditForm.clientId) {
      throw new Error('Selecciona un cliente disponible para continuar.')
    }
    if (!createClient) {
      throw new Error('Este cliente ya tiene un crédito activo o no cumple las condiciones de la tienda. Selecciona otro cliente.')
    }
    if (!creditForm.purchaseDate) {
      throw new Error('Selecciona la fecha de compra para continuar.')
    }

    const items = buildItems(creditForm.items, availableProducts)
    const payload = {
      clientId: Number(creditForm.clientId),
      purchaseDate: creditForm.purchaseDate,
      paymentMode: creditForm.paymentMode,
      items
    }

    if (!isInstallments) return payload

    if (!creditPolicy) {
      throw new Error('No pudimos consultar los límites de crédito de la tienda. Cierra la ventana e inténtalo nuevamente.')
    }
    return { ...payload, ...buildTerms(creditForm, creditPolicy) }
  }

  const createSimulation = useAutoSimulation(
    showCreditModal && isInstallments,
    [creditForm, creditPolicy, products, records],
    () => {
      const payload = buildPurchasePayload()
      return () => api.simulatePurchase(user.storeId, payload)
    }
  )

  async function createCredit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)

    try {
      const payload = buildPurchasePayload()
      const purchase = await api.createPurchase(user.storeId, payload)
      setShowCreditModal(false)

      if (payload.paymentMode === 'CASH') {
        setPaidPurchase(purchase)
        await loadData()
        return
      }

      const updatedData = await loadData()
      const createdPlan = updatedData?.financeData.flatMap(record =>
        record.plans.map(plan => ({ client: record.client, data: plan }))
      ).find(row => String(row.data.purchaseId) === String(purchase.id))

      if (createdPlan) {
        navigate(`/store/credits/${createdPlan.data.id}`)
      } else {
        setSuccess('Crédito registrado correctamente. No fue posible abrir su detalle automáticamente; puedes verlo desde la lista de créditos.')
      }
    } catch (createError) {
      setError(friendlyCreditError(createError, creditPolicy, createClient, createSimulation.plan?.principal))
    } finally {
      setSubmitting(false)
    }
  }

  const originalPrices = useMemo(() => {
    const prices = new Map()
    for (const item of selected?.data.items || []) prices.set(String(item.productId), Number(item.unitPrice))
    return prices
  }, [selected])

  function editPriceFor(product) {
    return originalPrices.get(String(product.id)) ?? product.creditPrice
  }

  function discardEdit() {
    setEditForm(formFromPlan(selected.data))
    setDetailError('')
  }

  function updateEditForm(changes) {
    setEditForm(current => ({ ...current, ...changes }))
    setPayingInstallment(null)
    setDetailError('')
  }

  function buildUpdatePayload() {
    if (!editForm.purchaseDate) {
      throw new Error('Selecciona la fecha de compra para continuar.')
    }
    return {
      purchaseDate: editForm.purchaseDate,
      ...buildTerms(editForm, creditPolicy),
      items: buildItems(editForm.items, installmentProducts)
    }
  }

  const editChanges = selected && editForm ? changedFields(editForm, formFromPlan(selected.data)) : []
  const editDirty = editChanges.length > 0

  const editSimulation = useAutoSimulation(
    editDirty,
    [editForm, selected?.data.id, creditPolicy, products],
    () => {
      const payload = buildUpdatePayload()
      const id = selected.data.id
      return () => api.simulateCreditPlanUpdate(user.storeId, id, payload)
    }
  )

  const paidBeforeEdit = (selected?.data.installments || [])
    .filter(item => item.type === 'STANDARD' && item.estado === 'PAID')

  async function saveEdit(event) {
    event?.preventDefault()
    if (savingEdit) return false
    setSavingEdit(true)
    setDetailError('')

    try {
      const id = selected.data.id
      const result = await api.updateCreditPlan(user.storeId, id, buildUpdatePayload())
      await loadData()
      const paidAmount = Number(result?.montoPagadoPrevio || 0)
      setNotice({
        planId: id,
        tone: paidAmount > 0 ? 'warning' : 'success',
        message: paidAmount > 0
          ? `Este crédito tenía ${money(paidAmount)} registrados como pagados antes de la modificación. Ese importe no se aplicó al nuevo cronograma: concílialo directamente con el cliente.`
          : 'Cambios guardados. El cronograma se recalculó con los nuevos datos.'
      })
      return true
    } catch (saveError) {
      setDetailError(friendlyCreditError(saveError, creditPolicy, selected?.client, editSimulation.plan?.principal))
      return false
    } finally {
      setSavingEdit(false)
    }
  }

  function openProductsEditor() {
    setProductsEditor({ originalItems: editForm.items })
    setDetailError('')
  }

  function cancelProductsEditor() {
    updateEditForm({ items: productsEditor.originalItems })
    setProductsEditor(null)
  }

  function applyProductsEditor() {
    if (editDirty && editSimulation.error) {
      setDetailError(friendlyCreditError(editSimulation.error, creditPolicy, selected?.client))
      return
    }
    setProductsEditor(null)
  }

  async function registerPayment() {
    if (paying || !payingInstallment) return
    setPaying(true)
    setDetailError('')
    try {
      await api.payInstallment(user.storeId, payingInstallment.id, paymentDate)
      setPayingInstallment(null)
      await loadData()
    } catch (paymentError) {
      setDetailError(friendlyCreditError(paymentError))
    } finally {
      setPaying(false)
    }
  }

  async function confirmDelete() {
    if (deleting || !deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteCreditPlan(user.storeId, deleteTarget.data.id)
      const name = `${deleteTarget.client.firstName} ${deleteTarget.client.lastName}`
      setDeleteTarget(null)
      if (planId) navigate('/store/credits')
      await loadData()
      setSuccess(`El crédito de ${name} se eliminó definitivamente.`)
    } catch (deleteError) {
      setDeleteTarget(null)
      setError(friendlyCreditError(deleteError))
    } finally {
      setDeleting(false)
    }
  }


  return (
    <section className="content-page">
      <PageBanner
        title="Créditos"
        actions={planId ? (
          <button className="secondary-button" type="button" onClick={() => navigate('/store/credits')}>
            ← Volver a créditos
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={openCreditModal} disabled={openingCredit || loading}>
            {openingCredit ? 'Preparando formulario...' : 'Nuevo crédito'}
          </button>
        )}
      />

      <ToastMessage message={error} onClose={() => setError('')} />
      <ToastMessage message={success} tone="success" onClose={() => setSuccess('')} />
      <ToastMessage message={detailError} onClose={() => setDetailError('')} />
      <ToastMessage message={notice?.message} tone={notice?.tone} onClose={() => setNotice(null)} />

      {!planId && (
        <div className="page-toolbar">
          <input
            className="search-input"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar cliente..."
          />
        </div>
      )}

      {loading && !selected && (
        <div className="screen-message compact">{planId ? 'Cargando crédito...' : 'Cargando créditos...'}</div>
      )}

      {planId && !loading && !selected && (
        <div className="empty-state">No encontramos este crédito. Puede que haya sido eliminado.</div>
      )}

      {!planId && !loading && (
        <section className="plain-section no-pad">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Capital</th>
                  <th>Próximo pago</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const next = row.data.installments?.find(item => item.estado === 'PENDING' || item.estado === 'OVERDUE')

                  return (
                    <tr key={row.data.id}>
                      <td>
                        <strong>{row.client.firstName} {row.client.lastName}</strong>
                        <span className="table-subtext">{row.client.documentNumber}</span>
                      </td>
                      <td>{money(row.data.principal)}</td>
                      <td>{next ? `${date(next.dueDate)} [${money(next.pagoTotal)}]` : '—'}</td>
                      <td>
                        <span className={`status-tag${row.data.status === 'PAID' ? '' : ' paid'}`}>
                          {row.data.status === 'PAID' ? 'Pagado' : 'Activo'}
                        </span>
                      </td>
                      <td className="row-actions">
                        <button className="text-button" type="button" onClick={() => navigate(`/store/credits/${row.data.id}`)}>Ver</button>
                        <button className="text-button" type="button" onClick={() => setDeleteTarget(row)}>Eliminar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showCreditModal && (
        <Modal title="Nuevo crédito" onClose={() => setShowCreditModal(false)} wide>
          <form className="credit-create-form" onSubmit={createCredit}>
            <div className="form-grid">
              <label>
                Cliente
                <select
                  value={creditForm.clientId}
                  onChange={event => updateCreditForm({ clientId: event.target.value })}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {eligibleClients.map(record => (
                    <option key={record.client.id} value={record.client.id}>
                      {record.client.firstName} {record.client.lastName} ({record.client.documentNumber})
                    </option>
                  ))}
                </select>
                {eligibleClients.length === 0 && (
                  <small className="field-alert">
                    {isInstallments && !creditPolicy
                      ? 'La tienda aún no tiene una política de crédito disponible.'
                      : isInstallments
                        ? 'No hay clientes disponibles para un crédito nuevo: deben estar activos y sin otro crédito pendiente.'
                        : 'No hay clientes activos disponibles para esta compra.'}
                  </small>
                )}
              </label>

              <label>
                Fecha de compra
                <input
                  type="date"
                  value={creditForm.purchaseDate}
                  onChange={event => updateCreditForm({ purchaseDate: event.target.value })}
                  required
                />
              </label>

              <label>
                Modalidad
                <select
                  value={creditForm.paymentMode}
                  onChange={event => {
                    const paymentMode = event.target.value
                    const matchingClients = records.filter(record => (
                      paymentMode === 'CASH' ? record.client.active === true : isEligibleForCredit(record, creditPolicy)
                    ))
                    updateCreditForm({
                      paymentMode,
                      clientId: matchingClients.some(record => String(record.client.id) === String(creditForm.clientId))
                        ? creditForm.clientId
                        : String(matchingClients[0]?.client.id || ''),
                      items: creditForm.items.filter(item => {
                        const product = products.find(candidate => String(candidate.id) === String(item.productId))
                        return paymentMode === 'CASH' || product?.allowsInstallments === true
                      })
                    })
                  }}
                >
                  <option value="CASH">Al contado</option>
                  <option value="INSTALLMENTS">Cuotas (método francés)</option>
                </select>
              </label>

              {isInstallments && (
                <CreditTermsFields
                  form={creditForm}
                  onChange={updateCreditForm}
                  policy={creditPolicy}
                />
              )}
            </div>

            <div className="credit-items">
              <div className="credit-items-heading">
                <h2>Productos</h2>
              </div>
              <ProductPicker
                products={availableProducts}
                items={creditForm.items}
                onChange={items => updateCreditForm({ items })}
                priceFor={product => (isInstallments ? product.creditPrice : product.cashPrice)}
                emptyMessage="No hay productos activos disponibles para esta modalidad de pago."
              />
            </div>

            {isInstallments && (
              <div className="credit-preview">
                {creditPolicy && (
                  <p className="credit-limits-note">Puedes financiar entre {money(creditPolicy.capitalMinimo)} y {money(creditPolicy.capitalMaximo)}, según la política de la tienda.</p>
                )}
                <SimulationResult
                  simulation={createSimulation}
                  policy={creditPolicy}
                  client={createClient}
                />
              </div>
            )}

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={submitting || availableProducts.length === 0 || eligibleClients.length === 0}>
                {submitting ? 'Registrando...' : 'Registrar crédito'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {paidPurchase && (
        <Modal title="Compra al contado registrada" onClose={() => setPaidPurchase(null)}>
          <div className="credit-detail">
            <p>Compra N.° {paidPurchase.id} registrada correctamente.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {(paidPurchase.items || []).map(item => (
                    <tr key={item.productId}>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <strong>Total {money(paidPurchase.total)}</strong>
          </div>
        </Modal>
      )}

      {selected && (
        <section className="credit-detail-page">
          <h2 className="credit-detail-title">{selected.client.firstName} {selected.client.lastName}</h2>
          <div className="credit-detail">
            <form className="credit-summary-panel" onSubmit={saveEdit}>
              <div className="section-title-row">
                <h2>Datos del crédito</h2>
                <div className="heading-actions">
                  {editDirty && (
                    <>
                      <span className="unsaved-chip" role="status" aria-live="polite">
                        <strong>Sin guardar</strong>
                        <span>({editChanges.join(', ')})</span>
                      </span>
                      <button className="secondary-button" type="button" onClick={discardEdit} disabled={savingEdit}>Descartar cambios</button>
                      <button className="primary-button" type="submit" disabled={savingEdit}>
                        {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </>
                  )}
                  {!editDirty && (
                    <>
                      <button className="secondary-button" type="button" onClick={() => setShowHistory(true)}>Historial de pagos</button>
                      <button className="primary-button" type="button" onClick={() => setDeleteTarget(selected)}>Eliminar crédito</button>
                    </>
                  )}
                </div>
              </div>

              {editForm && (
                <>
                  <div className="credit-summary-fields credit-summary-edit">
                    <div className="summary-static"><span>Cliente</span><strong>{selected.client.firstName} {selected.client.lastName} ({selected.client.documentNumber})</strong></div>
                    <label>
                      Fecha de compra
                      <input
                        type="date"
                        value={editForm.purchaseDate}
                        onChange={event => updateEditForm({ purchaseDate: event.target.value })}
                        required
                      />
                    </label>
                    <CreditTermsFields
                      form={editForm}
                      onChange={updateEditForm}
                      policy={creditPolicy}
                    />
                    <div className="summary-static">
                      <span>Capital financiado</span>
                      <button
                        type="button"
                        className="capital-toggle"
                        onClick={openProductsEditor}
                        aria-haspopup="dialog"
                        title="Editar productos"
                      >
                        <strong>
                          {editDirty
                            ? (editSimulation.plan ? money(editSimulation.plan.principal) : '—')
                            : money(selected.data.principal)}
                        </strong>
                        <span className="capital-toggle-detail">
                          {editForm.items.length} {editForm.items.length === 1 ? 'producto' : 'productos'}
                        </span>
                        <span className="capital-toggle-pencil" aria-hidden="true">✎</span>
                      </button>
                    </div>
                    <div className="summary-static">
                      <span>Estado</span>
                      <strong>
                        <span className={`status-tag${selected.data.status === 'PAID' ? '' : ' paid'}`}>
                          {selected.data.status === 'PAID' ? 'Pagado' : 'Activo'}
                        </span>
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </form>



            {editDirty ? (
              <div className="credit-preview">
                <SimulationResult simulation={editSimulation} policy={creditPolicy} client={selected.client} compact />
              </div>
            ) : (
              <>
                <FrenchScheduleTable
                  plan={selected.data}
                  showPaymentAction
                  onPay={(installment, trigger) => {
                    setPayingInstallment(installment)
                    setPayAnchor(trigger)
                    setDetailError('')
                  }}
                />
              </>
            )}
          </div>
        </section>
      )}

      {selected && payingInstallment && (
        <PaymentPopover
          anchor={payAnchor}
          installment={payingInstallment}
          paymentDate={paymentDate}
          setPaymentDate={setPaymentDate}
          onPay={registerPayment}
          onCancel={() => !paying && setPayingInstallment(null)}
          paying={paying}
          error={detailError}
        />
      )}

      {selected && editForm && productsEditor && (
        <Modal title="Productos del crédito" onClose={cancelProductsEditor} wide>
          <div className="credit-detail">
            <ProductPicker
              products={installmentProducts}
              items={editForm.items}
              onChange={items => updateEditForm({ items })}
              priceFor={editPriceFor}
              emptyMessage="No hay productos activos disponibles para pagos en cuotas."
            />
            <div className="form-actions detail-actions">
              <button className="secondary-button" type="button" onClick={cancelProductsEditor}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                onClick={applyProductsEditor}
              >
                Cambiar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selected && showHistory && (
        <Modal title="Historial de pagos" onClose={() => setShowHistory(false)} wide>
          <PaymentHistory plan={selected.data} />
        </Modal>
      )}


      {deleteTarget && (
        <Modal title="Eliminar crédito" onClose={() => !deleting && setDeleteTarget(null)}>
          <div className="credit-detail">
            <p>
              Vas a eliminar <strong>definitivamente</strong> el crédito de {deleteTarget.client.firstName} {deleteTarget.client.lastName} por {money(deleteTarget.data.principal)}.
            </p>
            <p>
              Se borrarán su cronograma, todos sus pagos registrados y la compra financiada con sus productos. El cliente y los productos de la tienda no se eliminan. Esta acción es permanente y no se puede deshacer.
            </p>
            <div className="form-actions detail-actions">
              <button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</button>
              <button className="primary-button" type="button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

function SimulationResult({ simulation, policy, client, compact = false }) {
  if (!simulation.plan) {
    return <p className="credit-limits-note">{simulation.loading ? 'Calculando cronograma...' : 'Completa los datos para ver el cronograma.'}</p>
  }
  const plan = simulation.plan
  if (compact) {
    return (
      <div className={simulation.loading ? 'simulation-refreshing' : ''}>
        <FrenchScheduleTable plan={plan} />
      </div>
    )
  }
  return (
    <div className={simulation.loading ? 'simulation-refreshing' : ''}>
      <div className="credit-detail-line">
        <span>Capital financiado</span>
        <strong>{money(plan.principal)}</strong>
        <span>Total de cuotas {money(plan.totalCuotas)}</span>
        <span>Intereses {money(plan.totalIntereses)}</span>
        {simulation.loading && <span>Actualizando...</span>}
      </div>
      <FrenchScheduleTable plan={plan} />
    </div>
  )
}

function PaymentHistory({ plan }) {
  const current = (plan.installments || [])
    .filter(item => item.type === 'STANDARD' && item.estado === 'PAID')
  const previous = plan.historicalPayments || []
  const currentTotal = current.reduce((sum, item) => sum + Number(item.pagoTotal || 0), 0)
  const previousTotal = previous.reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0)

  return (
    <div className="credit-detail">
      <section className="history-section">
        <h3 className="picker-step-title">Pagos del cronograma actual</h3>
        {current.length === 0 ? (
          <p className="picker-empty">Sin pagos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha de pago</th>
                  <th>Cuota</th>
                  <th>Vencimiento</th>
                  <th>Días de mora</th>
                  <th>Interés moratorio</th>
                  <th>Monto pagado</th>
                </tr>
              </thead>
              <tbody>
                {current.map(item => (
                  <tr key={item.id}>
                    <td>{date(item.paymentDate)}</td>
                    <td>{item.installmentNumber}</td>
                    <td>{date(item.dueDate)}</td>
                    <td>{item.diasMora || 0}</td>
                    <td>{money(item.interesMoratorio)}</td>
                    <td>{money(item.pagoTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="picker-total-row">
                  <td colSpan={5}>Total</td>
                  <td>{money(currentTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="history-section">
        <h3 className="picker-step-title">Pagos de cronogramas anteriores</h3>
        {previous.length === 0 ? (
          <p className="picker-empty">Sin pagos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha de pago</th>
                  <th>Cuota</th>
                  <th>Días de mora</th>
                  <th>Interés moratorio</th>
                  <th>Monto pagado</th>
                </tr>
              </thead>
              <tbody>
                {previous.map(payment => (
                  <tr key={payment.id}>
                    <td>{date(payment.paymentDate)}</td>
                    <td>{payment.installmentNumber}</td>
                    <td>{payment.diasMora || 0}</td>
                    <td>{money(payment.interesMoratorio)}</td>
                    <td>{money(payment.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="picker-total-row">
                  <td colSpan={4}>Total</td>
                  <td>{money(previousTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function PaymentPopover({ anchor, installment, paymentDate, setPaymentDate, onPay, onCancel, paying, error }) {
  const panelRef = useRef(null)
  const [position, setPosition] = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    function place() {
      const panel = panelRef.current
      if (!panel) return
      const margin = 8
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const row = anchor?.closest('tr, article')
      const rect = (row || anchor)?.getBoundingClientRect()
      const button = anchor?.getBoundingClientRect()
      if (!rect || !button) {
        setPosition({ top: margin, left: window.innerWidth - width - margin })
        return
      }
      let top = rect.bottom + margin
      if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - margin)
      const left = Math.min(Math.max(margin, button.right - width), window.innerWidth - width - margin)
      setPosition({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor, error])

  useEffect(() => {
    panelRef.current?.querySelector('input')?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [onCancel])

  return createPortal(
    <div
      ref={panelRef}
      className="pay-popover"
      role="dialog"
      aria-labelledby="pay-popover-title"
      style={{ top: position.top, left: position.left }}
      onMouseDown={event => event.stopPropagation()}
    >
      <strong id="pay-popover-title">¿Marcar como pagada la cuota {installment.installmentNumber}?</strong>
      <span className="pay-popover-detail">
        Vence {date(installment.dueDate)} (a pagar hoy {money(installment.pagoTotal)})
      </span>
      <label>
        Fecha de pago
        <input
          type="date"
          value={paymentDate}
          onChange={event => setPaymentDate(event.target.value)}
          required
        />
      </label>
      <div className="pay-popover-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={paying}>Cancelar</button>
        <button className="primary-button" type="button" onClick={onPay} disabled={paying || !paymentDate}>
          {paying ? 'Registrando...' : 'Confirmar pago'}
        </button>
      </div>
    </div>,
    document.body
  )
}
