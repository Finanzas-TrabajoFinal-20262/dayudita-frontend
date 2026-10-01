import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/api'
import FrenchScheduleTable from '../../components/FrenchScheduleTable'
import PageBanner from '../../components/PageBanner'

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function date(value) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-PE')
}

export default function ClientCreditsPage() {
  const [plans, setPlans] = useState([])
  const [statements, setStatements] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.getClientCreditPlans(),
      api.getClientStatements(),
      api.getClientPayments()
    ])
      .then(([planData, statementData, paymentData]) => {
        setPlans(planData || [])
        setStatements(statementData || [])
        setPayments(paymentData || [])
      })
      .catch(loadError => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [])

  const activePlan = useMemo(
    () => plans.find(plan => plan.status === 'ACTIVE'),
    [plans]
  )
  const nextInstallment = activePlan?.installments?.find(item => item.status === 'PENDING')
  const openStatements = statements.filter(statement => statement.status === 'OPEN')

  return (
    <section className="content-page">
      <PageBanner title="Mis créditos" />

      {error && <div className="alert-band">{error}</div>}
      {loading && <div className="screen-message compact">Cargando créditos...</div>}

      {!loading && (
        <>
          <div className="credit-summary-line">
            <div>
              <span>Plan activo</span>
              <strong>{activePlan ? money(activePlan.capitalizedPrincipal) : '—'}</strong>
            </div>
            <div>
              <span>Próxima cuota</span>
              <strong>{nextInstallment ? money(nextInstallment.amount) : '—'}</strong>
              <small>
                {nextInstallment ? date(nextInstallment.dueDate) : 'Sin cuota pendiente'}
              </small>
            </div>
            <div>
              <span>Pagos únicos pendientes</span>
              <strong>{openStatements.length}</strong>
            </div>
          </div>

          {plans.length === 0 ? (
            <p className="empty-state">Todavía no tienes planes en cuotas.</p>
          ) : (
            plans.map(plan => (
              <section className="plain-section" key={plan.id}>
                <div className="section-title-row">
                  <h2>Deuda #{plan.id}</h2>
                  <span className="status-text">
                    {plan.status === 'ACTIVE' ? 'Activa' : 'Pagada'}
                  </span>
                </div>
                <FrenchScheduleTable plan={plan} />
              </section>
            ))
          )}

          <section className="plain-section">
            <h2>Estados de cuenta</h2>
            {statements.length === 0 ? (
              <p className="muted">No hay estados de cuenta.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Corte</th>
                      <th>Vencimiento</th>
                      <th>Capital</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map(statement => (
                      <tr key={statement.id}>
                        <td>{date(statement.cutoffDate)}</td>
                        <td>{date(statement.dueDate)}</td>
                        <td>{money(statement.principal)}</td>
                        <td>{money(statement.totalAmount)}</td>
                        <td>{statement.status === 'PAID' ? 'Pagado' : 'Pendiente'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {payments.length > 0 && (
            <section className="plain-section">
              <h2>Pagos realizados</h2>
              <div className="payment-list">
                {payments.map(payment => (
                  <div className="payment-row" key={payment.id}>
                    <div>
                      <strong>{money(payment.totalAmount)}</strong>
                      <span>{date(payment.paymentDate)}</span>
                    </div>
                    <span>{payment.type === 'INSTALLMENT' ? 'Cuota' : 'Estado de cuenta'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
