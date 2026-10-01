import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import FrenchScheduleTable from '../../components/FrenchScheduleTable'
import PageBanner from '../../components/PageBanner'

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function date(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-PE') : '—'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function codeFor(product) {
  return product.code || `DAYU-${String(product.id).padStart(4, '0')}`
}

function nextCutoffDate(cutoffDay) {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()

  if (now.getDate() > cutoffDay) {
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(cutoffDay, lastDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const emptyCredit = {
  clientId: '',
  purchaseDate: today(),
  paymentMode: 'SINGLE_PAYMENT',
  installmentCount: 4,
  items: [{ code: '', quantity: 1 }]
}

export default function StoreCreditsPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [showStatementModal, setShowStatementModal] = useState(false)
  const [creditForm, setCreditForm] = useState(emptyCredit)
  const [statementForm, setStatementForm] = useState({ clientId: '', cutoffDate: '' })
  const [paymentDate, setPaymentDate] = useState(today())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [clientData, productData] = await Promise.all([
        api.getStoreClients(user.storeId),
        api.getStoreProducts(user.storeId)
      ])

      const financeData = await Promise.all(
        clientData.map(async client => {
          const [plans, statements] = await Promise.all([
            api.getStoreCreditPlans(user.storeId, client.id),
            api.getStoreStatements(user.storeId, client.id)
          ])
          return { client, plans, statements }
        })
      )

      setProducts(productData || [])
      setRecords(financeData)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return records
      .flatMap(record => [
        ...record.plans.map(plan => ({ kind: 'plan', client: record.client, data: plan })),
        ...record.statements.map(statement => ({ kind: 'statement', client: record.client, data: statement }))
      ])
      .filter(row => {
        if (!query) return true
        const clientText = `${row.client.firstName} ${row.client.lastName} ${row.client.documentNumber}`
        return clientText.toLowerCase().includes(query)
      })
  }, [records, search])

  function openCreditModal() {
    const firstClient = records.find(record => record.client.active)?.client
    setCreditForm({
      ...emptyCredit,
      clientId: firstClient ? String(firstClient.id) : ''
    })
    setShowCreditModal(true)
  }

  function openStatementModal() {
    const firstClient = records.find(record => record.client.active)?.client
    setStatementForm({
      clientId: firstClient ? String(firstClient.id) : '',
      cutoffDate: firstClient ? nextCutoffDate(firstClient.cutoffDay) : ''
    })
    setShowStatementModal(true)
  }

  function changeStatementClient(clientId) {
    const client = records.find(record => String(record.client.id) === clientId)?.client
    setStatementForm({
      clientId,
      cutoffDate: client ? nextCutoffDate(client.cutoffDay) : ''
    })
  }

  function updateItem(index, field, value) {
    setCreditForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      ))
    }))
  }

  function addItem() {
    setCreditForm(current => ({
      ...current,
      items: [...current.items, { code: '', quantity: 1 }]
    }))
  }

  function removeItem(index) {
    setCreditForm(current => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  async function createCredit(event) {
    event.preventDefault()
    setError('')

    try {
      const items = creditForm.items.map(item => {
        const typedCode = item.code.trim().toUpperCase()
        const product = products.find(candidate => codeFor(candidate).toUpperCase() === typedCode)

        if (!product) {
          throw new Error(`No existe el producto ${item.code || '(sin código)'}`)
        }

        return {
          productId: product.id,
          quantity: Number(item.quantity)
        }
      })

      await api.createPurchase(user.storeId, {
        clientId: Number(creditForm.clientId),
        purchaseDate: creditForm.purchaseDate,
        paymentMode: creditForm.paymentMode,
        installmentCount: creditForm.paymentMode === 'INSTALLMENTS'
          ? Number(creditForm.installmentCount)
          : null,
        items
      })

      setShowCreditModal(false)
      await loadData()
    } catch (createError) {
      setError(createError.message)
    }
  }

  async function generateStatement(event) {
    event.preventDefault()
    setError('')

    try {
      await api.generateStatement(
        user.storeId,
        Number(statementForm.clientId),
        statementForm.cutoffDate
      )
      setShowStatementModal(false)
      await loadData()
    } catch (statementError) {
      setError(statementError.message)
    }
  }

  async function registerPayment() {
    try {
      if (selected.kind === 'statement') {
        await api.payStatement(user.storeId, selected.data.id, paymentDate)
      } else if (selected.installment) {
        await api.payInstallment(user.storeId, selected.installment.id, paymentDate)
      }

      setSelected(null)
      await loadData()
    } catch (paymentError) {
      setError(paymentError.message)
    }
  }

  return (
    <section className="content-page">
      <PageBanner
        title="Créditos"
        actions={
          <div className="heading-actions">
            <button className="secondary-button" type="button" onClick={openStatementModal}>
              Generar estado
            </button>
            <button className="primary-button" type="button" onClick={openCreditModal}>
              Nuevo crédito
            </button>
          </div>
        }
      />

      {error && <div className="alert-band">{error}</div>}

      <div className="page-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar cliente..."
        />
      </div>

      {loading && <div className="screen-message compact">Cargando créditos...</div>}

      {!loading && (
        <section className="plain-section no-pad">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Total</th>
                  <th>Próximo pago</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const next = row.kind === 'plan'
                    ? row.data.installments?.find(item => item.status === 'PENDING')
                    : null
                  const amount = row.kind === 'plan'
                    ? row.data.capitalizedPrincipal
                    : row.data.totalAmount
                  const nextPayment = row.kind === 'plan'
                    ? (next ? `${date(next.dueDate)} · ${money(next.amount)}` : '—')
                    : `${date(row.data.dueDate)} · ${money(row.data.totalAmount)}`

                  return (
                    <tr key={`${row.kind}-${row.data.id}`}>
                      <td>
                        <strong>{row.client.firstName} {row.client.lastName}</strong>
                        <span className="table-subtext">{row.client.documentNumber}</span>
                      </td>
                      <td>{row.kind === 'plan' ? 'Cuotas quincenales' : 'Pago único'}</td>
                      <td>{money(amount)}</td>
                      <td>{nextPayment}</td>
                      <td>{row.data.status === 'PAID' ? 'Pagado' : 'Pendiente'}</td>
                      <td>
                        <button className="text-button" type="button" onClick={() => setSelected(row)}>Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showStatementModal && (
        <Modal title="Generar estado de cuenta" onClose={() => setShowStatementModal(false)}>
          <form className="stack-form" onSubmit={generateStatement}>
            <label>
              Cliente
              <select
                value={statementForm.clientId}
                onChange={event => changeStatementClient(event.target.value)}
                required
              >
                <option value="">Selecciona un cliente</option>
                {records.filter(record => record.client.active).map(record => (
                  <option key={record.client.id} value={record.client.id}>
                    {record.client.firstName} {record.client.lastName} · corte día {record.client.cutoffDay}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha de corte
              <input
                type="date"
                value={statementForm.cutoffDate}
                onChange={event => setStatementForm({ ...statementForm, cutoffDate: event.target.value })}
                required
              />
            </label>
            <button className="primary-button" type="submit">Generar estado</button>
          </form>
        </Modal>
      )}

      {showCreditModal && (
        <Modal title="Nuevo crédito" onClose={() => setShowCreditModal(false)} wide>
          <form className="credit-create-form" onSubmit={createCredit}>
            <div className="form-grid">
              <label>
                Cliente
                <select
                  value={creditForm.clientId}
                  onChange={event => setCreditForm({ ...creditForm, clientId: event.target.value })}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {records.filter(record => record.client.active).map(record => (
                    <option key={record.client.id} value={record.client.id}>
                      {record.client.firstName} {record.client.lastName} · {record.client.documentNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fecha de compra
                <input
                  type="date"
                  value={creditForm.purchaseDate}
                  onChange={event => setCreditForm({ ...creditForm, purchaseDate: event.target.value })}
                  required
                />
              </label>

              <label>
                Modalidad
                <select
                  value={creditForm.paymentMode}
                  onChange={event => setCreditForm({ ...creditForm, paymentMode: event.target.value })}
                >
                  <option value="SINGLE_PAYMENT">Pago único</option>
                  <option value="INSTALLMENTS">Cuotas</option>
                </select>
              </label>

              {creditForm.paymentMode === 'INSTALLMENTS' && (
                <label>
                  Número de cuotas
                  <input
                    type="number"
                    min="1"
                    value={creditForm.installmentCount}
                    onChange={event => setCreditForm({ ...creditForm, installmentCount: event.target.value })}
                    required
                  />
                </label>
              )}
            </div>

            <div className="credit-items">
              <h2>Productos</h2>
              {creditForm.items.map((item, index) => (
                <div className="credit-item-row" key={index}>
                  <label>
                    Código
                    <input
                      value={item.code}
                      onChange={event => updateItem(index, 'code', event.target.value)}
                      placeholder="DAYU-0001"
                      required
                    />
                  </label>
                  <label>
                    Cantidad
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={event => updateItem(index, 'quantity', event.target.value)}
                      required
                    />
                  </label>
                  {creditForm.items.length > 1 && (
                    <button className="text-button" type="button" onClick={() => removeItem(index)}>
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button className="secondary-button" type="button" onClick={addItem}>
                Agregar producto
              </button>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit">Registrar crédito</button>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal
          title={`${selected.client.firstName} ${selected.client.lastName}`}
          onClose={() => setSelected(null)}
          wide
        >
          {selected.kind === 'statement' ? (
            <div className="credit-detail">
              <div className="credit-detail-line">
                <span>Total</span>
                <strong>{money(selected.data.totalAmount)}</strong>
                <span>Vence {date(selected.data.dueDate)}</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Compra</th>
                      <th>Fecha</th>
                      <th>Capital</th>
                      <th>Interés</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.data.items.map(item => (
                      <tr key={item.purchaseId}>
                        <td>#{item.purchaseId}</td>
                        <td>{date(item.purchaseDate)}</td>
                        <td>{money(item.principal)}</td>
                        <td>{money(item.compensatoryInterest)}</td>
                        <td>{money(item.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected.data.status === 'OPEN' && (
                <PaymentBox
                  paymentDate={paymentDate}
                  setPaymentDate={setPaymentDate}
                  onPay={registerPayment}
                  label="Registrar pago"
                />
              )}
            </div>
          ) : (
            <div className="credit-detail">
              <FrenchScheduleTable
                plan={selected.data}
                showPaymentAction
                onPay={installment => setSelected({ ...selected, installment })}
              />
              {selected.installment && (
                <PaymentBox
                  paymentDate={paymentDate}
                  setPaymentDate={setPaymentDate}
                  onPay={registerPayment}
                  label={`Pagar cuota ${selected.installment.installmentNumber}`}
                />
              )}
            </div>
          )}
        </Modal>
      )}
    </section>
  )
}

function PaymentBox({ paymentDate, setPaymentDate, onPay, label }) {
  return (
    <div className="payment-box">
      <label>
        Fecha de pago
        <input
          type="date"
          value={paymentDate}
          onChange={event => setPaymentDate(event.target.value)}
        />
      </label>
      <button className="primary-button" type="button" onClick={onPay}>{label}</button>
    </div>
  )
}
