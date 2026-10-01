function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function date(value) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-PE')
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(4)}%`
}

export default function FrenchScheduleTable({ plan, showPaymentAction, onPay }) {
  return (
    <div className="french-plan">
      <div className="schedule-heading">
        <h2>Tabla de método francés</h2>
        <p>Quincenal · {plan.paymentPeriodDays || 15} días · {plan.installmentCount} cuotas</p>
      </div>

      <div className="table-wrap schedule-table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>TEA</th>
              <th>TEP</th>
              <th>Plazo gracia</th>
              <th>Saldo inicial</th>
              <th>Interés</th>
              <th>Cuota</th>
              <th>Amort.</th>
              <th>Saldo final</th>
              <th>Estado</th>
              {showPaymentAction && <th></th>}
            </tr>
          </thead>
          <tbody>
            {plan.graceDays > 0 && (
              <tr className="grace-row">
                <td>G</td>
                <td>{date(plan.graceEndDate)}</td>
                <td>{percent(plan.annualEffectiveRate)}</td>
                <td>{percent(plan.graceRate)}</td>
                <td>T</td>
                <td>{money(plan.principal)}</td>
                <td>{money(plan.graceInterest)}</td>
                <td>{money(0)}</td>
                <td>{money(0)}</td>
                <td>{money(plan.capitalizedPrincipal)}</td>
                <td>Gracia total</td>
                {showPaymentAction && <td></td>}
              </tr>
            )}

            {(plan.installments || []).map(item => (
              <tr key={item.id}>
                <td>{item.installmentNumber}</td>
                <td>{date(item.dueDate)}</td>
                <td>{percent(plan.annualEffectiveRate)}</td>
                <td>{percent(plan.periodRate)}</td>
                <td>S</td>
                <td>{money(item.openingBalance)}</td>
                <td>{money(item.interest)}</td>
                <td>{money(item.amount)}</td>
                <td>{money(item.amortization)}</td>
                <td>{money(item.remainingBalance)}</td>
                <td>{item.status === 'PAID' ? 'Pagada' : 'Pendiente'}</td>
                {showPaymentAction && (
                  <td>
                    {item.status === 'PENDING' && (
                      <button className="text-button" type="button" onClick={() => onPay(item)}>Pagar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
