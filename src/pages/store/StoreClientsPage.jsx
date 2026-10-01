import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import PageBanner from '../../components/PageBanner'

const emptyClient = {
  firstName: '',
  lastName: '',
  documentNumber: '',
  email: '',
  password: '',
  phone: '',
  cutoffDay: 25,
  paymentDay: 5
}

export default function StoreClientsPage() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyClient)
  const [lookupDocument, setLookupDocument] = useState('')
  const [foundClient, setFoundClient] = useState(null)
  const [saving, setSaving] = useState(false)

  async function loadClients() {
    try {
      setClients(await api.getStoreClients(user.storeId))
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => { loadClients() }, [])

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients

    return clients.filter(client => {
      const clientText = `${client.firstName} ${client.lastName} ${client.documentNumber} ${client.email}`
      return clientText.toLowerCase().includes(query)
    })
  }, [clients, search])

  function openCreate() {
    setForm(emptyClient)
    setModal('create')
  }

  function openAssociate() {
    setForm(emptyClient)
    setModal('associate')
    setFoundClient(null)
    setLookupDocument('')
  }

  function openEdit(client) {
    setForm({
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone || '',
      cutoffDay: client.cutoffDay,
      paymentDay: client.paymentDay
    })
    setFoundClient(client)
    setModal('edit')
  }

  async function saveClient(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (modal === 'create') {
        await api.createClient(user.storeId, form)
        setNotice('Cliente registrado correctamente.')
      } else {
        await api.updateClient(user.storeId, foundClient.id, form)
        setNotice('Datos del cliente actualizados.')
      }

      setModal(null)
      await loadClients()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(client) {
    try {
      await api.updateClientStatus(user.storeId, client.id, !client.active)
      await loadClients()
    } catch (statusError) {
      setError(statusError.message)
    }
  }

  async function lookupExisting(event) {
    event.preventDefault()
    setFoundClient(null)
    setError('')

    try {
      setFoundClient(await api.lookupClient(user.storeId, lookupDocument))
    } catch (lookupError) {
      setError(lookupError.message)
    }
  }

  async function associateExisting(event) {
    event.preventDefault()

    try {
      await api.associateClient(user.storeId, foundClient.id, {
        cutoffDay: Number(form.cutoffDay),
        paymentDay: Number(form.paymentDay)
      })
      setModal(null)
      setNotice('Cliente asociado a la tienda.')
      await loadClients()
    } catch (associateError) {
      setError(associateError.message)
    }
  }

  return (
    <section className="content-page">
      <PageBanner
        title="Clientes"
        actions={
          <div className="heading-actions">
            <button className="secondary-button" type="button" onClick={openAssociate}>Asociar existente</button>
            <button className="primary-button" type="button" onClick={openCreate}>Nuevo cliente</button>
          </div>
        }
      />

      {error && <div className="alert-band">{error}</div>}
      {notice && <div className="success-band">{notice}</div>}

      <div className="page-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por nombre, DNI o correo..."
        />
      </div>

      <section className="paper-section no-pad">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Contacto</th>
                <th>Corte</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map(client => (
                <tr key={client.clientAccountId}>
                  <td>
                    <strong>{client.firstName} {client.lastName}</strong>
                    <span className="table-subtext">{client.email}</span>
                  </td>
                  <td>{client.documentNumber}</td>
                  <td>{client.phone || '—'}</td>
                  <td>Día {client.cutoffDay}</td>
                  <td>Día {client.paymentDay}</td>
                  <td>
                    <span className={`status-tag ${client.active ? 'paid' : 'inactive'}`}>
                      {client.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="text-button" type="button" onClick={() => openEdit(client)}>Editar</button>
                    <button className="text-button" type="button" onClick={() => toggleStatus(client)}>
                      {client.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Nuevo cliente' : 'Editar cliente'}
          onClose={() => setModal(null)}
          wide
        >
          <form className="form-grid" onSubmit={saveClient}>
            <label>
              Nombre
              <input
                value={form.firstName}
                onChange={event => setForm({ ...form, firstName: event.target.value })}
                required
              />
            </label>
            <label>
              Apellido
              <input
                value={form.lastName}
                onChange={event => setForm({ ...form, lastName: event.target.value })}
                required
              />
            </label>

            {modal === 'create' && (
              <label>
                Documento
                <input
                  value={form.documentNumber}
                  onChange={event => setForm({ ...form, documentNumber: event.target.value })}
                  required
                />
              </label>
            )}
            {modal === 'create' && (
              <label>
                Correo
                <input
                  type="email"
                  value={form.email}
                  onChange={event => setForm({ ...form, email: event.target.value })}
                  required
                />
              </label>
            )}
            {modal === 'create' && (
              <label>
                Contraseña
                <input
                  type="password"
                  minLength="6"
                  value={form.password}
                  onChange={event => setForm({ ...form, password: event.target.value })}
                  required
                />
              </label>
            )}

            <label>
              Teléfono
              <input
                value={form.phone || ''}
                onChange={event => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label>
              Día de corte
              <input
                type="number"
                min="1"
                max="30"
                value={form.cutoffDay}
                onChange={event => setForm({ ...form, cutoffDay: Number(event.target.value) })}
                required
              />
            </label>
            <label>
              Día de pago
              <input
                type="number"
                min="1"
                max="30"
                value={form.paymentDay}
                onChange={event => setForm({ ...form, paymentDay: Number(event.target.value) })}
                required
              />
            </label>

            <div className="form-actions full-span">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'associate' && (
        <Modal title="Asociar cliente existente" onClose={() => setModal(null)}>
          <form className="stack-form" onSubmit={lookupExisting}>
            <label>
              Documento del cliente
              <input
                value={lookupDocument}
                onChange={event => setLookupDocument(event.target.value)}
                required
              />
            </label>
            <button className="secondary-button" type="submit">Buscar</button>
          </form>

          {foundClient && (
            <form className="associate-result" onSubmit={associateExisting}>
              <div>
                <strong>{foundClient.firstName} {foundClient.lastName}</strong>
                <span>{foundClient.email}</span>
              </div>

              {foundClient.alreadyAssociated ? (
                <div className="alert-band">Este cliente ya está asociado a la tienda.</div>
              ) : (
                <>
                  <label>
                    Día de corte
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={form.cutoffDay}
                      onChange={event => setForm({ ...form, cutoffDay: Number(event.target.value) })}
                      required
                    />
                  </label>
                  <label>
                    Día de pago
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={form.paymentDay}
                      onChange={event => setForm({ ...form, paymentDay: Number(event.target.value) })}
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit">Asociar a mi tienda</button>
                </>
              )}
            </form>
          )}
        </Modal>
      )}
    </section>
  )
}
