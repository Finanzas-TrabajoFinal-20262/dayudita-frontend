import { useEffect, useMemo, useState } from 'react'
import { ToastMessage } from '../../context/ToastContext'
import { api } from '../../api/api'
import Modal from '../../components/Modal'
import PageBanner from '../../components/PageBanner'
import { localImage, productCode } from '../../utils/productImages'

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

export default function ClientProductsPage() {
  const [accounts, setAccounts] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getClientAccounts()
      .then(data => {
        const accountList = data || []
        setAccounts(accountList)
        if (accountList.length) setSelectedStoreId(String(accountList[0].storeId))
      })
      .catch(loadError => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedStoreId) {
      setProducts([])
      return
    }

    setLoading(true)
    setError('')
    api.getClientProducts(selectedStoreId)
      .then(data => setProducts(data || []))
      .catch(loadError => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [selectedStoreId])

  const visibleProducts = useMemo(() => {
    const query = normalize(search)
    if (!query) return products

    return products.filter(product => {
      const searchableText = [
        product.name,
        product.description,
        product.supplier,
        product.brand,
        product.code,
        productCode(product)
      ].map(normalize).join(' ')

      return searchableText.includes(query)
    })
  }, [products, search])

  return (
    <section className="content-page products-page">
      <PageBanner title="Productos" />

      <div className="page-toolbar products-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar producto..."
          aria-label="Buscar producto"
        />
        {accounts.length > 1 && (
          <select value={selectedStoreId} onChange={event => setSelectedStoreId(event.target.value)}>
            {accounts.map(account => (
              <option key={account.clientAccountId} value={account.storeId}>{account.storeName}</option>
            ))}
          </select>
        )}
        {accounts.length === 1 && <span className="store-stamp">{accounts[0].storeName}</span>}
      </div>

      <ToastMessage message={error} onClose={() => setError('')} />
      {loading && <div className="screen-message compact">Cargando productos...</div>}

      {!loading && !error && visibleProducts.length === 0 && (
        <div className="empty-state">No encontramos productos con esa búsqueda.</div>
      )}

      <div className="product-grid">
        {visibleProducts.map(product => {
          const image = product.imageUrl || localImage(product)
          return (
            <article className="product-card" key={product.id}>
              <img
                src={image}
                alt={product.name}
                onError={event => { event.currentTarget.src = localImage(product) }}
              />
              <div className="product-copy">
                <h2>{product.name}</h2>
                <strong>{money(product.creditPrice)}</strong>
                <button className="primary-button" type="button" onClick={() => setSelectedProduct(product)}>
                  Ver detalle
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {selectedProduct && (
        <Modal title={selectedProduct.name} onClose={() => setSelectedProduct(null)}>
          <div className="product-detail-modal">
            <img
              src={selectedProduct.imageUrl || localImage(selectedProduct)}
              alt={selectedProduct.name}
              onError={event => { event.currentTarget.src = localImage(selectedProduct) }}
            />
            <div className="product-detail-copy">
              <p>{selectedProduct.description || 'Producto disponible en Dayu.'}</p>
              <div className="product-code-block">
                <span>Código del producto</span>
                <strong>{productCode(selectedProduct)}</strong>
              </div>
              <p>Precio a crédito: <strong>{money(selectedProduct.creditPrice)}</strong></p>
              <p>Muéstrale este código a la administradora de la tienda para que pueda gestionar tu compra a crédito.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setSelectedProduct(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
