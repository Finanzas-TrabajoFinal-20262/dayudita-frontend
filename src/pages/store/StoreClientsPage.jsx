import { useEffect, useMemo, useState } from 'react'
import { ToastMessage } from '../../context/ToastContext'
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
  phone: ''
}

export default function StoreClientsPage() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyClient)
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

  function openEdit(client) {
    setForm({
      firstName: client.firstName,
      lastName: client.lastName,
      documentNumber: client.documentNumber,
      email: client.email,
      phone: client.phone || ''
    })
    setFoundClient(client)
    setModal('edit')
  }

  async function saveClient(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const personalData = {
      firstName: form.firstName,
      lastName: form.lastName,
      documentNumber: form.documentNumber,
      email: form.email,
      phone: form.phone
    }

    try {
      if (modal === 'create') {
        await api.createClient(user.storeId, { ...personalData, password: form.password })
        setNotice('Cliente registrado correctamente.')
      } else {
        await api.updateClient(user.storeId, foundClient.id, personalData)
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

  return (
    <section className="content-page">
      <PageBanner
        title="Clientes"
        actions={
          <button className="primary-button" type="button" onClick={openCreate}>Nuevo cliente</button>
        }
      />

      <ToastMessage message={error} onClose={() => setError('')} />
      <ToastMessage message={notice} tone="success" onClose={() => setNotice('')} />

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
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map(client => (
                <tr key={client.clientAccountId}>
                  <td><strong>{client.firstName} {client.lastName}</strong></td>
                  <td>{client.documentNumber}</td>
                  <td>{client.email}</td>
                  <td>{client.phone || '—'}</td>
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
              Nombres
              <input
                value={form.firstName}
                onChange={event => setForm({ ...form, firstName: event.target.value })}
                required
              />
            </label>
            <label>
              Apellidos
              <input
                value={form.lastName}
                onChange={event => setForm({ ...form, lastName: event.target.value })}
                required
              />
            </label>
            <label>
              Documento de identidad
              <input
                value={form.documentNumber}
                onChange={event => setForm({ ...form, documentNumber: event.target.value })}
                required
              />
            </label>
            <label>
              Correo electrónico
              <input
                type="email"
                value={form.email}
                onChange={event => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label>
              Teléfono
              <input
                value={form.phone || ''}
                onChange={event => setForm({ ...form, phone: event.target.value })}
              />
            </label>
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

            <div className="form-actions full-span">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </section>
  )
}
