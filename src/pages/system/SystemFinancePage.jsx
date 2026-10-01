import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import PageBanner from '../../components/PageBanner'

function asPercent(value) {
  return (Number(value || 0) * 100).toFixed(4)
}

function asDecimal(value) {
  return Number(value || 0) / 100
}

export default function SystemFinancePage() {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.getFinancialConfiguration()
      .then(data => setForm({
        ...data,
        minAnnualEffectiveRate: asPercent(data.minAnnualEffectiveRate),
        maxAnnualEffectiveRate: asPercent(data.maxAnnualEffectiveRate),
        annualEffectiveRate: asPercent(data.annualEffectiveRate),
        moratoryAnnualEffectiveRate: asPercent(data.moratoryAnnualEffectiveRate)
      }))
      .catch(loadError => setError(loadError.message))
  }, [])

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    try {
      const updated = await api.updateFinancialConfiguration({
        minAnnualEffectiveRate: asDecimal(form.minAnnualEffectiveRate),
        maxAnnualEffectiveRate: asDecimal(form.maxAnnualEffectiveRate),
        annualEffectiveRate: asDecimal(form.annualEffectiveRate),
        moratoryAnnualEffectiveRate: asDecimal(form.moratoryAnnualEffectiveRate),
        minCapital: Number(form.minCapital),
        maxCapital: Number(form.maxCapital),
        creditLimit: Number(form.creditLimit),
        maxInstallments: Number(form.maxInstallments)
      })

      setForm({
        ...updated,
        minAnnualEffectiveRate: asPercent(updated.minAnnualEffectiveRate),
        maxAnnualEffectiveRate: asPercent(updated.maxAnnualEffectiveRate),
        annualEffectiveRate: asPercent(updated.annualEffectiveRate),
        moratoryAnnualEffectiveRate: asPercent(updated.moratoryAnnualEffectiveRate)
      })
      setNotice('Configuración guardada.')
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  if (!form && error) {
    return (
      <section className="content-page">
        <PageBanner title="Configuración financiera" />
        <div className="alert-band">{error}</div>
      </section>
    )
  }

  if (!form) {
    return <div className="screen-message">Cargando configuración...</div>
  }

  return (
    <section className="content-page">
      <PageBanner title="Configuración financiera" />

      {error && <div className="alert-band">{error}</div>}
      {notice && <div className="success-band">{notice}</div>}

      <div className="finance-fixed-line">
        <span>Moneda <strong>{form.currency}</strong></span>
        <span>Año comercial <strong>{form.commercialYearDays} días</strong></span>
        <span>Cuotas <strong>cada {form.paymentPeriodDays} días</strong></span>
      </div>

      <form className="finance-form" onSubmit={save}>
        <div className="form-grid">
          <label>
            TEA mínima (%)
            <input
              type="number"
              step="0.0001"
              value={form.minAnnualEffectiveRate}
              onChange={event => updateField('minAnnualEffectiveRate', event.target.value)}
              required
            />
          </label>
          <label>
            TEA máxima (%)
            <input
              type="number"
              step="0.0001"
              value={form.maxAnnualEffectiveRate}
              onChange={event => updateField('maxAnnualEffectiveRate', event.target.value)}
              required
            />
          </label>
          <label>
            TEA (%)
            <input
              type="number"
              step="0.0001"
              value={form.annualEffectiveRate}
              onChange={event => updateField('annualEffectiveRate', event.target.value)}
              required
            />
          </label>
          <label>
            Tasa moratoria anual (%)
            <input
              type="number"
              step="0.0001"
              value={form.moratoryAnnualEffectiveRate}
              onChange={event => updateField('moratoryAnnualEffectiveRate', event.target.value)}
              required
            />
          </label>
          <label>
            Capital mínimo (S/)
            <input
              type="number"
              step="0.01"
              value={form.minCapital}
              onChange={event => updateField('minCapital', event.target.value)}
              required
            />
          </label>
          <label>
            Capital máximo (S/)
            <input
              type="number"
              step="0.01"
              value={form.maxCapital}
              onChange={event => updateField('maxCapital', event.target.value)}
              required
            />
          </label>
          <label>
            Límite de crédito (S/)
            <input
              type="number"
              step="0.01"
              value={form.creditLimit}
              onChange={event => updateField('creditLimit', event.target.value)}
              required
            />
          </label>
          <label>
            Máximo de cuotas quincenales
            <input
              type="number"
              min="1"
              value={form.maxInstallments}
              onChange={event => updateField('maxInstallments', event.target.value)}
              required
            />
          </label>
        </div>
        <button className="primary-button" type="submit">Guardar</button>
      </form>
    </section>
  )
}
