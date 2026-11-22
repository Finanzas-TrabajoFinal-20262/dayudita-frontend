import { useEffect, useMemo, useState } from 'react'
import { ToastMessage } from '../../context/ToastContext'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import PageBanner from '../../components/PageBanner'
import { localImage, productCode, productImage } from '../../utils/productImages'

const emptyProduct = {
  name: '',
  description: '',
  brand: '',
  supplier: '',
  unitOfMeasure: 'unidad',
  imageUrl: '',
  cashPrice: '',
  creditPrice: '',
  allowsInstallments: true
}

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function emptyToNull(value) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

export default function StoreProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyProduct)
  const [editingProduct, setEditingProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadProducts() {
    try {
      setProducts(await api.getStoreProducts(user.storeId) || [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter(product => [
      product.name,
      product.description,
      product.brand,
      product.supplier,
      productCode(product)
    ].join(' ').toLowerCase().includes(query))
  }, [products, search])

  function openCreate() {
    setForm(emptyProduct)
    setEditingProduct(null)
    setError('')
    setModal('create')
  }

  function openEdit(product) {
    setForm({
      name: product.name || '',
      description: product.description || '',
      brand: product.brand || '',
      supplier: product.supplier || '',
      unitOfMeasure: product.unitOfMeasure || '',
      imageUrl: product.imageUrl || '',
      cashPrice: product.cashPrice,
      creditPrice: product.creditPrice,
      allowsInstallments: product.allowsInstallments === true
    })
    setEditingProduct(product)
    setError('')
    setModal('edit')
  }

  async function saveProduct(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      description: emptyToNull(form.description),
      brand: emptyToNull(form.brand),
      supplier: emptyToNull(form.supplier),
      unitOfMeasure: emptyToNull(form.unitOfMeasure),
      imageUrl: emptyToNull(form.imageUrl),
      cashPrice: Number(form.cashPrice),
      creditPrice: Number(form.creditPrice),
      allowsInstallments: Boolean(form.allowsInstallments)
    }

    try {
      if (modal === 'create') {
        await api.createProduct(user.storeId, payload)
        setNotice('Producto registrado correctamente.')
      } else {
        await api.updateProduct(user.storeId, editingProduct.id, payload)
        setNotice('Producto actualizado.')
      }
      setModal(null)
      await loadProducts()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(product) {
    setError('')
    try {
      await api.updateProductStatus(user.storeId, product.id, product.active === false)
      await loadProducts()
    } catch (statusError) {
      setError(statusError.message)
    }
  }

  const previewImage = form.imageUrl.trim() ? form.imageUrl.trim() : localImage(form)

  return (
    <section className="content-page">
      <PageBanner
        title="Productos"
        actions={<button className="primary-button" type="button" onClick={openCreate}>Nuevo producto</button>}
      />

      <ToastMessage message={error} onClose={() => setError('')} />
      <ToastMessage message={notice} tone="success" onClose={() => setNotice('')} />

      <div className="page-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por nombre, código o marca..."
        />
      </div>

      {loading && <div className="screen-message compact">Cargando productos...</div>}

      {!loading && visibleProducts.length === 0 && (
        <div className="empty-state">{products.length === 0 ? 'Todavía no hay productos registrados.' : 'No encontramos productos con esa búsqueda.'}</div>
      )}

      {!loading && (
        <div className="product-grid">
          {visibleProducts.map(product => {
            const active = product.active !== false
            return (
              <article className={`product-card admin-product-card${active ? '' : ' is-inactive'}`} key={product.id}>
                <img
                  src={productImage(product)}
                  alt={product.name}
                  onError={event => { event.currentTarget.src = localImage(product) }}
                />
                <div className="product-copy">
                  <div className="admin-product-tags">
                    <span className="admin-product-code">{productCode(product)}</span>
                    <span className={`status-tag ${active ? 'paid' : 'inactive'}`}>{active ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <h2>{product.name}</h2>
                  <strong>{money(product.creditPrice)}</strong>
                  <span className="admin-product-meta">
                    Al contado {money(product.cashPrice)} ({product.allowsInstallments ? 'permite cuotas' : 'sin cuotas'})
                  </span>
                  <div className="admin-product-actions">
                    <button className="primary-button" type="button" onClick={() => openEdit(product)}>Editar</button>
                    <button className="secondary-button" type="button" onClick={() => toggleStatus(product)}>
                      {active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal
          title={modal === 'create' ? 'Nuevo producto' : 'Editar producto'}
          onClose={() => setModal(null)}
          wide
        >
          <form className="form-grid" onSubmit={saveProduct}>
            <label>
              Nombre
              <input
                maxLength="100"
                value={form.name}
                onChange={event => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label>
              Marca
              <input
                maxLength="100"
                value={form.brand}
                onChange={event => setForm({ ...form, brand: event.target.value })}
              />
            </label>
            <label className="full-span">
              Descripción
              <input
                maxLength="300"
                value={form.description}
                onChange={event => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <label>
              Proveedor
              <input
                maxLength="100"
                value={form.supplier}
                onChange={event => setForm({ ...form, supplier: event.target.value })}
              />
            </label>
            <label>
              Unidad de medida
              <input
                maxLength="50"
                value={form.unitOfMeasure}
                onChange={event => setForm({ ...form, unitOfMeasure: event.target.value })}
              />
            </label>
            <label>
              Precio al contado (S/)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.cashPrice}
                onChange={event => setForm({ ...form, cashPrice: event.target.value })}
                required
              />
            </label>
            <label>
              Precio a crédito (S/)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.creditPrice}
                onChange={event => setForm({ ...form, creditPrice: event.target.value })}
                required
              />
            </label>
            <label className="full-span">
              URL de imagen
              <input
                type="url"
                maxLength="500"
                value={form.imageUrl}
                onChange={event => setForm({ ...form, imageUrl: event.target.value })}
              />
            </label>
            <label className="checkbox-label full-span">
              <input
                type="checkbox"
                checked={form.allowsInstallments}
                onChange={event => setForm({ ...form, allowsInstallments: event.target.checked })}
              />
              Permite pago en cuotas
            </label>
            <div className="product-form-preview full-span">
              <img
                src={previewImage}
                alt=""
                onError={event => { event.currentTarget.src = localImage(form) }}
              />
            </div>

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
