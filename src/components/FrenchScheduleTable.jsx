import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function amount(value) {
  return Number(value || 0).toFixed(2)
}

function date(value) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-PE')
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(4)}%`
}

function rate9(value) {
  return Number(value || 0).toFixed(9)
}

function rateDecimal(value) {
  return String(Number(value || 0))
}

const TYPE_LABEL = {
  TOTAL: 'T',
  STANDARD: 'S'
}

const STATUS_LABEL = {
  GRACE_TOTAL: 'Gracia total',
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  OVERDUE: 'Vencida'
}


function statusRowClass(estado) {
  if (estado === 'OVERDUE') return 'schedule-row-overdue'
  if (estado === 'PAID') return 'schedule-row-paid'
  return ''
}

const Eq = ({ children }) => <math display="block"><mrow>{children}</mrow></math>
const V = ({ children }) => <mi>{children}</mi>
const T = ({ children }) => <mtext>{children}</mtext>
const O = ({ children }) => <mo>{children}</mo>
const N = ({ children }) => <mn>{children}</mn>
const Sub = ({ base, index }) => (
  <msub><mi>{base}</mi>{typeof index === 'number' ? <mn>{index}</mn> : <mi>{index}</mi>}</msub>
)
const Paren = ({ children }) => <mrow><mo>(</mo>{children}<mo>)</mo></mrow>
const OnePlus = ({ rate }) => <Paren><mn>1</mn><mo>+</mo><mi>{rate}</mi></Paren>
const Pow = ({ base, exponent }) => <msup>{base}{exponent}</msup>
const Frac = ({ num, den }) => <mfrac><mrow>{num}</mrow><mrow>{den}</mrow></mfrac>

function explainTea() {
  return {
    title: 'TEA del crédito',
    formula: <Eq><V>TEA</V><O>=</O><T>tasa efectiva anual pactada</T></Eq>,
    description: 'Es propia de este crédito y se convierte a tasa quincenal para el cronograma.'
  }
}

function explainTeq() {
  return {
    title: 'Tasa del periodo (TEQ)',
    formula: (
      <Eq>
        <V>TEQ</V><O>=</O>
        <Pow base={<OnePlus rate="TEA" />} exponent={<Frac num={<N>15</N>} den={<N>360</N>} />} />
        <O>−</O><N>1</N>
      </Eq>
    ),
    description: 'Tasa quincenal equivalente a la TEA en un año comercial de 360 días.'
  }
}

function explainMoratoryTea() {
  return {
    title: 'TEA moratoria del crédito',
    formula: <Eq><Sub base="TEA" index="m" /><O>=</O><T>tasa efectiva anual por atraso</T></Eq>,
    description: 'Solo genera interés cuando una cuota se paga después de su vencimiento.'
  }
}

function explainOpening(item) {
  const k = item.installmentNumber
  if (k === 1) {
    return {
      title: 'Saldo inicial (periodo 1)',
      formula: <Eq><Sub base="SI" index={1} /><O>=</O><T>capital financiado</T></Eq>,
      description: 'Es el importe total de la compra que se financia.'
    }
  }
  return {
    title: `Saldo inicial (periodo ${k})`,
    formula: <Eq><Sub base="SI" index={k} /><O>=</O><Sub base="SF" index={k - 1} /></Eq>,
    description: 'Es el saldo final del periodo anterior.'
  }
}

function explainInterest(item) {
  const k = item.installmentNumber
  return {
    title: `Interés (periodo ${k})`,
    formula: <Eq><Sub base="I" index={k} /><O>=</O><Sub base="SI" index={k} /><O>×</O><V>TEQ</V></Eq>,
    description: item.type === 'TOTAL'
      ? 'En gracia total este interés no se paga: se suma al saldo.'
      : 'Interés del periodo sobre el saldo pendiente.'
  }
}

function explainPayment(item, plan) {
  const k = item.installmentNumber
  if (item.type === 'TOTAL') {
    return {
      title: `Cuota (periodo ${k})`,
      formula: <Eq><Sub base="R" index={k} /><O>=</O><N>0</N></Eq>,
      description: 'Periodo de gracia total: no se paga cuota.'
    }
  }
  const m = plan.installmentCount - k + 1
  const factor = <Pow base={<OnePlus rate="TEQ" />} exponent={<N>{m}</N>} />
  return {
    title: `Cuota (periodo ${k})`,
    formula: (
      <Eq>
        <Sub base="R" index={k} /><O>=</O><Sub base="SI" index={k} /><O>×</O>
        <Frac
          num={<><V>TEQ</V><O>×</O>{factor}</>}
          den={<>{factor}<O>−</O><N>1</N></>}
        />
      </Eq>
    ),
    description: `Cuota del método francés repartida en los ${m} ${m === 1 ? 'periodo que queda' : 'periodos que quedan'}.`
  }
}

function explainAmortization(item) {
  const k = item.installmentNumber
  if (item.type === 'TOTAL') {
    return {
      title: `Amortización (periodo ${k})`,
      formula: <Eq><Sub base="A" index={k} /><O>=</O><N>0</N></Eq>,
      description: 'En gracia total no se devuelve capital.'
    }
  }
  return {
    title: `Amortización (periodo ${k})`,
    formula: <Eq><Sub base="A" index={k} /><O>=</O><Sub base="R" index={k} /><O>−</O><Sub base="I" index={k} /></Eq>,
    description: 'Parte de la cuota que reduce el capital pendiente.'
  }
}

function explainClosing(item) {
  const k = item.installmentNumber
  if (item.type === 'TOTAL') {
    return {
      title: `Saldo final (periodo ${k})`,
      formula: <Eq><Sub base="SF" index={k} /><O>=</O><Sub base="SI" index={k} /><O>+</O><Sub base="I" index={k} /></Eq>,
      description: 'En gracia total el interés se suma al saldo.'
    }
  }
  return {
    title: `Saldo final (periodo ${k})`,
    formula: <Eq><Sub base="SF" index={k} /><O>=</O><Sub base="SI" index={k} /><O>−</O><Sub base="A" index={k} /></Eq>,
    description: 'Capital que queda pendiente después de la cuota.'
  }
}

function explainOverdueDays(item) {
  const k = item.installmentNumber
  return {
    title: `Días de mora (periodo ${k})`,
    formula: (
      <Eq>
        <Sub base="d" index={k} /><O>=</O><V>DÍAS360</V>
        <Paren><Sub base="F" index="venc" /><O>,</O><Sub base="F" index="pago" /></Paren>
      </Eq>
    ),
    description: 'Días comerciales de atraso desde el vencimiento hasta el pago (o hasta hoy).'
  }
}

function explainMoratoryInterest(item) {
  const k = item.installmentNumber
  return {
    title: `Interés moratorio (periodo ${k})`,
    formula: (
      <Eq>
        <Sub base="IM" index={k} /><O>=</O><Sub base="R" index={k} /><O>×</O>
        <mrow>
          <mo>[</mo>
          <Pow
            base={<Paren><N>1</N><O>+</O><Sub base="TEA" index="m" /></Paren>}
            exponent={<Frac num={<Sub base="d" index={k} />} den={<N>360</N>} />}
          />
          <O>−</O><N>1</N>
          <mo>]</mo>
        </mrow>
      </Eq>
    ),
    description: 'Recargo por pagar la cuota después de su vencimiento.'
  }
}

function explainTotalPayment(item) {
  const k = item.installmentNumber
  return {
    title: `Pago total (periodo ${k})`,
    formula: <Eq><Sub base="PT" index={k} /><O>=</O><Sub base="R" index={k} /><O>+</O><Sub base="IM" index={k} /></Eq>,
    description: 'Importe a cobrar por esta cuota, con mora si la hay.'
  }
}

const Sum = ({ term }) => (
  <mrow>
    <munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>
    <Sub base={term} index="k" />
  </mrow>
)

function explainTotal(kind) {
  if (kind === 'interest') {
    return {
      title: 'Total de intereses',
      formula: <Eq><Sub base="I" index="total" /><O>=</O><Sum term="I" /></Eq>,
      description: 'Suma de los intereses de todos los periodos, incluidos los de la gracia.'
    }
  }
  if (kind === 'payment') {
    return {
      title: 'Total de cuotas',
      formula: <Eq><Sub base="R" index="total" /><O>=</O><Sum term="R" /></Eq>,
      description: 'Lo que se paga en total sin mora.'
    }
  }
  if (kind === 'amortization') {
    return {
      title: 'Total de amortización',
      formula: <Eq><Sum term="A" /><O>=</O><V>C</V><O>+</O><Sub base="I" index="gracia" /></Eq>,
      description: 'Capital financiado más los intereses capitalizados en la gracia.'
    }
  }
  if (kind === 'moratory') {
    return {
      title: 'Total de interés moratorio',
      formula: <Eq><Sub base="IM" index="total" /><O>=</O><Sum term="IM" /></Eq>,
      description: 'Mora acumulada de todas las cuotas.'
    }
  }
  return {
    title: 'Pago total con mora',
    formula: <Eq><V>Total</V><O>=</O><Sum term="R" /><O>+</O><Sum term="IM" /></Eq>,
    description: 'Lo que suma el crédito con la mora calculada hasta hoy.'
  }
}

const Num = ({ children }) => <mn>{children}</mn>
const rate = value => Number(value || 0).toFixed(9)
const amt = value => Number(value || 0).toFixed(2)
const dec = value => String(Number(value || 0))
const OnePlusNum = ({ value }) => <Paren><N>1</N><O>+</O><Num>{value}</Num></Paren>

function subTea(plan) {
  return <Eq><V>TEA</V><O>=</O><Num>{percent(plan.teaPactada)}</Num></Eq>
}

function subTeq(plan) {
  return (
    <Eq>
      <V>TEQ</V><O>=</O>
      <Pow base={<OnePlusNum value={dec(plan.teaPactada)} />} exponent={<Frac num={<N>15</N>} den={<N>360</N>} />} />
      <O>−</O><N>1</N><O>=</O><Num>{rate(plan.teq)}</Num>
    </Eq>
  )
}

function subMoratoryTea(plan) {
  return <Eq><Sub base="TEA" index="m" /><O>=</O><Num>{percent(plan.teaMoratoriaPactada)}</Num></Eq>
}

function subOpening(item) {
  const k = item.installmentNumber
  return <Eq><Sub base="SI" index={k} /><O>=</O><Num>{amt(item.openingBalance)}</Num></Eq>
}

function subInterest(item, plan) {
  const k = item.installmentNumber
  return (
    <Eq>
      <Sub base="I" index={k} /><O>=</O><Num>{amt(item.openingBalance)}</Num><O>×</O>
      <Num>{rate(item.tasaPeriodo ?? plan.teq)}</Num><O>=</O><Num>{amt(item.interest)}</Num>
    </Eq>
  )
}

function subPayment(item, plan) {
  const k = item.installmentNumber
  if (item.type === 'TOTAL') return <Eq><Sub base="R" index={k} /><O>=</O><Num>0.00</Num></Eq>
  const m = plan.installmentCount - k + 1
  const teq = rate(item.tasaPeriodo ?? plan.teq)
  const factor = <Pow base={<OnePlusNum value={teq} />} exponent={<N>{m}</N>} />
  return (
    <Eq>
      <Sub base="R" index={k} /><O>=</O><Num>{amt(item.openingBalance)}</Num><O>×</O>
      <Frac num={<><Num>{teq}</Num><O>×</O>{factor}</>} den={<>{factor}<O>−</O><N>1</N></>} />
      <O>=</O><Num>{amt(item.amount)}</Num>
    </Eq>
  )
}

function subAmortization(item) {
  const k = item.installmentNumber
  if (item.type === 'TOTAL') return <Eq><Sub base="A" index={k} /><O>=</O><Num>0.00</Num></Eq>
  return (
    <Eq>
      <Sub base="A" index={k} /><O>=</O><Num>{amt(item.amount)}</Num><O>−</O><Num>{amt(item.interest)}</Num>
      <O>=</O><Num>{amt(item.amortization)}</Num>
    </Eq>
  )
}

function subClosing(item) {
  const k = item.installmentNumber
  const grace = item.type === 'TOTAL'
  return (
    <Eq>
      <Sub base="SF" index={k} /><O>=</O><Num>{amt(item.openingBalance)}</Num>
      <O>{grace ? '+' : '−'}</O><Num>{amt(grace ? item.interest : item.amortization)}</Num>
      <O>=</O><Num>{amt(item.remainingBalance)}</Num>
    </Eq>
  )
}

function subOverdueDays(item) {
  const k = item.installmentNumber
  const reference = item.fechaReferenciaMora || item.paymentDate
  if (item.type === 'TOTAL' || !reference) {
    return <Eq><Sub base="d" index={k} /><O>=</O><Num>{item.diasMora || 0}</Num></Eq>
  }
  return (
    <Eq>
      <Sub base="d" index={k} /><O>=</O><V>DÍAS360</V>
      <Paren><Num>{date(item.dueDate)}</Num><O>,</O><Num>{date(reference)}</Num></Paren>
      <O>=</O><Num>{item.diasMora || 0}</Num>
    </Eq>
  )
}

function subMoratoryInterest(item, plan) {
  const k = item.installmentNumber
  const days = item.diasMora || 0
  return (
    <Eq>
      <Sub base="IM" index={k} /><O>=</O><Num>{amt(item.amount)}</Num><O>×</O>
      <mrow>
        <mo>[</mo>
        <Pow
          base={<OnePlusNum value={dec(plan.teaMoratoriaPactada)} />}
          exponent={<Frac num={<Num>{days}</Num>} den={<N>360</N>} />}
        />
        <O>−</O><N>1</N>
        <mo>]</mo>
      </mrow>
      <O>=</O><Num>{amt(item.interesMoratorio)}</Num>
    </Eq>
  )
}

function subTotalPayment(item) {
  const k = item.installmentNumber
  return (
    <Eq>
      <Sub base="PT" index={k} /><O>=</O><Num>{amt(item.amount)}</Num><O>+</O><Num>{amt(item.interesMoratorio)}</Num>
      <O>=</O><Num>{amt(item.pagoTotal)}</Num>
    </Eq>
  )
}

function subTotal(kind, plan) {
  if (kind === 'interest') return <Eq><Sub base="I" index="total" /><O>=</O><Sum term="I" /><O>=</O><Num>{amt(plan.totalIntereses)}</Num></Eq>
  if (kind === 'payment') return <Eq><Sub base="R" index="total" /><O>=</O><Sum term="R" /><O>=</O><Num>{amt(plan.totalCuotas)}</Num></Eq>
  if (kind === 'amortization') {
    return (
      <Eq>
        <Sum term="A" /><O>=</O><Num>{amt(plan.principal)}</Num><O>+</O><Num>{amt(plan.interesCapitalizado)}</Num>
        <O>=</O><Num>{amt(plan.totalAmortizacion)}</Num>
      </Eq>
    )
  }
  if (kind === 'moratory') return <Eq><Sub base="IM" index="total" /><O>=</O><Sum term="IM" /><O>=</O><Num>{amt(plan.totalInteresMoratorio)}</Num></Eq>
  return (
    <Eq>
      <V>Total</V><O>=</O><Num>{amt(plan.totalAPagar)}</Num><O>+</O><Num>{amt(plan.totalInteresMoratorio)}</Num>
      <O>=</O><Num>{amt(plan.totalAPagarConMora)}</Num>
    </Eq>
  )
}

const withValues = (explanation, substituted) => ({ ...explanation, substituted })

function ExplainValue({ children, explanation, onOpen }) {
  return (
    <button
      type="button"
      className="explain-value"
      onClick={event => onOpen(explanation, event.currentTarget)}
      aria-haspopup="dialog"
    >
      {children}
    </button>
  )
}

function ExplanationPopover({ state, onClose }) {
  const [showValues, setShowValues] = useState(false)
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const [position, setPosition] = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const rect = state.trigger.getBoundingClientRect()
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    const margin = 8
    let top = rect.bottom + margin
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - height - margin)
    }
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin)
    setPosition({ top, left: Math.max(margin, left) })
  }, [state])

  useEffect(() => {
    closeRef.current?.focus()

    function handleKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose(true)
      }
    }
    function handlePointer(event) {
      if (panelRef.current?.contains(event.target) || state.trigger.contains(event.target)) return
      onClose(false)
    }
    function handleScroll(event) {
      if (panelRef.current?.contains(event.target)) return
      onClose(false)
    }

    document.addEventListener('keydown', handleKey, true)
    document.addEventListener('mousedown', handlePointer, true)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('keydown', handleKey, true)
      document.removeEventListener('mousedown', handlePointer, true)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [state, onClose])

  const { explanation } = state

  return createPortal(
    <div
      ref={panelRef}
      className="explain-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby="explain-popover-title"
      style={{ top: position.top, left: position.left }}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="explain-popover-head">
        <strong id="explain-popover-title">{explanation.title}</strong>
        <button ref={closeRef} type="button" className="explain-popover-close" onClick={() => onClose(true)} aria-label="Cerrar explicación">×</button>
      </div>
      <div
        className={`explain-equation${explanation.substituted ? ' has-values' : ''}`}
        tabIndex={explanation.substituted ? 0 : undefined}
        onMouseEnter={() => setShowValues(true)}
        onMouseLeave={() => setShowValues(false)}
        onFocus={() => setShowValues(true)}
        onBlur={() => setShowValues(false)}
        aria-label={explanation.substituted ? 'Ecuación; al pasar el cursor muestra los valores del crédito' : undefined}
      >
        {showValues && explanation.substituted ? explanation.substituted : explanation.formula}
      </div>
      <p>{explanation.description}</p>
    </div>,
    document.body
  )
}

export default function FrenchScheduleTable({ plan, showPaymentAction, onPay }) {
  const installments = plan.installments || []
  const [popover, setPopover] = useState(null)
  const firstPayableIndex = installments.findIndex(
    item => item.estado === 'PENDING' || item.estado === 'OVERDUE'
  )
  const graceCount = plan.periodosGracia ?? Math.round((plan.diasGraciaTotal || 0) / (plan.paymentPeriodDays || 15))

  function openExplanation(explanation, trigger) {
    setPopover(current => (current?.trigger === trigger ? null : { explanation, trigger }))
  }

  function closeExplanation(returnFocus) {
    setPopover(current => {
      if (returnFocus && current?.trigger) current.trigger.focus()
      return null
    })
  }

  const ev = (content, explanation) => (
    <ExplainValue explanation={explanation} onOpen={openExplanation}>{content}</ExplainValue>
  )

  function rowValues(item, index) {
    const previous = index > 0 ? installments[index - 1] : null
    return {
      rate: ev(percent(item.tasaPeriodo), withValues(explainTeq(), subTeq(plan))),
      opening: ev(money(item.openingBalance), withValues(explainOpening(item), subOpening(item))),
      interest: ev(money(item.interest), withValues(explainInterest(item), subInterest(item, plan))),
      payment: ev(`(${money(item.amount)})`, withValues(explainPayment(item, plan), subPayment(item, plan))),
      amortization: ev(`(${money(item.amortization)})`, withValues(explainAmortization(item), subAmortization(item))),
      closing: ev(money(item.remainingBalance), withValues(explainClosing(item), subClosing(item))),
      overdueDays: ev(item.diasMora || 0, withValues(explainOverdueDays(item), subOverdueDays(item))),
      moratory: ev(`(${money(item.interesMoratorio)})`, withValues(explainMoratoryInterest(item), subMoratoryInterest(item, plan))),
      total: ev(`(${money(item.pagoTotal)})`, withValues(explainTotalPayment(item), subTotalPayment(item)))
    }
  }

  const totals = {
    interest: ev(money(plan.totalIntereses), withValues(explainTotal('interest'), subTotal('interest', plan))),
    payment: ev(`(${money(plan.totalCuotas)})`, withValues(explainTotal('payment'), subTotal('payment', plan))),
    amortization: ev(`(${money(plan.totalAmortizacion)})`, withValues(explainTotal('amortization'), subTotal('amortization', plan))),
    moratory: ev(`(${money(plan.totalInteresMoratorio)})`, withValues(explainTotal('moratory'), subTotal('moratory', plan))),
    total: ev(`(${money(plan.totalAPagarConMora)})`, withValues(explainTotal('total'), subTotal('total', plan)))
  }

  return (
    <div className="french-plan">
      <div className="schedule-heading">
        <h2>Tabla de método francés</h2>
      </div>

      <div className="table-wrap schedule-table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Vencimiento</th>
              <th>Días</th>
              <th>Tasa periodo</th>
              <th>Tipo</th>
              <th>Saldo inicial</th>
              <th>Interés</th>
              <th>Cuota</th>
              <th>Amortización</th>
              <th>Saldo final</th>
              <th>Días mora</th>
              <th>Interés moratorio</th>
              <th>Pago total</th>
              <th>Estado</th>
              {showPaymentAction && <th></th>}
            </tr>
          </thead>
          <tbody>
            {installments.map((item, index) => {
              const values = rowValues(item, index)
              return (
                <tr key={item.id ?? index} className={statusRowClass(item.estado)}>
                  <td>{item.installmentNumber}</td>
                  <td>{date(item.dueDate)}</td>
                  <td>{item.diasPeriodo}</td>
                  <td>{values.rate}</td>
                  <td>{TYPE_LABEL[item.type] || item.type}</td>
                  <td>{values.opening}</td>
                  <td>{values.interest}</td>
                  <td>{values.payment}</td>
                  <td>{values.amortization}</td>
                  <td>{values.closing}</td>
                  <td>{values.overdueDays}</td>
                  <td>{values.moratory}</td>
                  <td>{values.total}</td>
                  <td>{STATUS_LABEL[item.estado] || item.estado}</td>
                  {showPaymentAction && (
                    <td>
                      {index === firstPayableIndex && (
                        <button className="text-button" type="button" onClick={event => onPay(item, event.currentTarget)}>Marcar como pagado</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="schedule-totals-row">
              <td colSpan={6}>Totales</td>
              <td>{totals.interest}</td>
              <td>{totals.payment}</td>
              <td>{totals.amortization}</td>
              <td></td>
              <td></td>
              <td>{totals.moratory}</td>
              <td>{totals.total}</td>
              <td></td>
              {showPaymentAction && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="schedule-card-list">
        {installments.map((item, index) => {
          const values = rowValues(item, index)
          return (
            <article key={item.id ?? index} className={`schedule-card ${statusRowClass(item.estado)}`}>
              <div className="schedule-card-heading">
                <strong>Cuota {item.installmentNumber}</strong>
                <span>{STATUS_LABEL[item.estado] || item.estado}</span>
              </div>
              <dl className="schedule-card-fields">
                <div><dt>Vencimiento</dt><dd>{date(item.dueDate)}</dd></div>
                <div><dt>Días del periodo</dt><dd>{item.diasPeriodo}</dd></div>
                <div><dt>Tasa del periodo</dt><dd>{values.rate}</dd></div>
                <div><dt>Tipo</dt><dd>{TYPE_LABEL[item.type] || item.type}</dd></div>
                <div><dt>Saldo inicial</dt><dd>{values.opening}</dd></div>
                <div><dt>Interés</dt><dd>{values.interest}</dd></div>
                <div><dt>Cuota</dt><dd>{values.payment}</dd></div>
                <div><dt>Amortización</dt><dd>{values.amortization}</dd></div>
                <div><dt>Saldo final</dt><dd>{values.closing}</dd></div>
                <div><dt>Días de mora</dt><dd>{values.overdueDays}</dd></div>
                <div><dt>Interés moratorio</dt><dd>{values.moratory}</dd></div>
                <div><dt>Pago total</dt><dd>{values.total}</dd></div>
              </dl>
              {showPaymentAction && index === firstPayableIndex && (
                <div className="schedule-card-pay">
                  <button className="primary-button" type="button" onClick={event => onPay(item, event.currentTarget)}>Marcar como pagado</button>
                </div>
              )}
            </article>
          )
        })}
        <article className="schedule-card schedule-card-totals">
          <div className="schedule-card-heading"><strong>Totales</strong></div>
          <dl className="schedule-card-fields">
            <div><dt>Intereses</dt><dd>{totals.interest}</dd></div>
            <div><dt>Cuotas</dt><dd>{totals.payment}</dd></div>
            <div><dt>Amortización</dt><dd>{totals.amortization}</dd></div>
            <div><dt>Interés moratorio</dt><dd>{totals.moratory}</dd></div>
            <div><dt>Pago total con mora</dt><dd>{totals.total}</dd></div>
          </dl>
        </article>
      </div>

      {popover && <ExplanationPopover state={popover} onClose={closeExplanation} />}
    </div>
  )
}
