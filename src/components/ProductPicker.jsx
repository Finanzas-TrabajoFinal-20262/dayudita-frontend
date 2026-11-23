import { useEffect, useId, useRef, useState } from 'react'
import { ToastMessage } from '../context/ToastContext'
import { localImage, productCode, productImage } from '../utils/productImages'

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

function Thumb({ product, className = 'picker-thumb' }) {
  if (!product) return <span className={`${className} picker-thumb-empty`} aria-hidden="true" />
  return (
    <img
      className={className}
      src={productImage(product)}
      alt=""
      onError={event => { event.currentTarget.src = localImage(product) }}
    />
  )
}

function ProductSelect({ products, value, onChange, addedIds, labelledBy, priceFor }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()
  const selected = products.find(product => String(product.id) === String(value))

  useEffect(() => {
    if (!open) return undefined
    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function openList() {
    const index = products.findIndex(product => String(product.id) === String(value))
    setActiveIndex(index >= 0 ? index : 0)
    setOpen(true)
  }

  function choose(product) {
    onChange(product)
    setOpen(false)
  }

  function handleKeyDown(event) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      openList()
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(products.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(0, index - 1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (products[activeIndex]) choose(products[activeIndex])
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
      }
      setOpen(false)
    }
  }

  return (
    <div className="product-select" ref={rootRef}>
      <button
        type="button"
        className="product-select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelledBy} ${listId}-value`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        disabled={products.length === 0}
      >
        <Thumb product={selected} />
        <span className="product-select-label" id={`${listId}-value`}>
          {selected ? selected.name : 'Selecciona un producto'}
        </span>
        {selected && <span className="product-select-price">{money(priceFor(selected))}</span>}
        <span className="product-select-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="product-select-list" role="listbox" id={listId} ref={listRef}>
          {products.map((product, index) => {
            const added = addedIds.has(String(product.id))
            return (
              <li
                key={product.id}
                role="option"
                data-index={index}
                aria-selected={String(product.id) === String(value)}
                className={`product-select-option${index === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => choose(product)}
              >
                <Thumb product={product} />
                <span className="product-select-option-copy">
                  <strong>{product.name}</strong>
                  <span>{productCode(product)}{added ? ' (ya agregado)' : ''}</span>
                </span>
                <span className="product-select-price">{money(priceFor(product))}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function ProductPicker({ products, items, onChange, priceFor, emptyMessage }) {
  const [candidateId, setCandidateId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [highlightId, setHighlightId] = useState('')
  const rowRefs = useRef({})
  const selectLabelId = useId()
  const addedIds = new Set(items.map(item => String(item.productId)))
  const candidate = products.find(product => String(product.id) === String(candidateId))

  useEffect(() => {
    if (!highlightId) return undefined
    const timer = setTimeout(() => setHighlightId(''), 2500)
    return () => clearTimeout(timer)
  }, [highlightId])

  function selectCandidate(product) {
    setMessage('')
    if (addedIds.has(String(product.id))) {
      setCandidateId('')
      setMessage(`${product.name} ya está en la lista. Cambia su cantidad allí.`)
      setHighlightId(String(product.id))
      rowRefs.current[String(product.id)]?.focus()
      return
    }
    setCandidateId(String(product.id))
    setQuantity(1)
  }

  function addCandidate() {
    if (!candidate) return
    const value = Number(quantity)
    if (!Number.isInteger(value) || value < 1) {
      setMessage('Indica una cantidad de al menos 1 unidad.')
      return
    }
    if (addedIds.has(String(candidate.id))) {
      setMessage(`${candidate.name} ya está en la lista. Cambia su cantidad allí.`)
      return
    }
    onChange([...items, { productId: String(candidate.id), quantity: value }])
    setCandidateId('')
    setQuantity(1)
    setMessage('')
  }

  function removeProduct(productId) {
    onChange(items.filter(item => String(item.productId) !== String(productId)))
  }

  function changeQuantity(productId, value) {
    onChange(items.map(item => (
      String(item.productId) === String(productId) ? { ...item, quantity: value } : item
    )))
  }

  const rows = items.map(item => {
    const product = products.find(candidateProduct => String(candidateProduct.id) === String(item.productId))
    const unitPrice = product ? Number(priceFor(product)) : 0
    const units = Number(item.quantity)
    return { item, product, unitPrice, subtotal: Number.isFinite(units) ? unitPrice * units : 0 }
  })
  const total = rows.reduce((sum, row) => sum + row.subtotal, 0)

  return (
    <div className="product-picker">
      {products.length === 0 ? (
        <p className="field-hint">{emptyMessage}</p>
      ) : (
        <div className="picker-step">
          <h3 className="picker-step-title">Agregar un producto</h3>
          <div className={`picker-add-row${candidate ? ' with-quantity' : ''}`}>
          <div className="picker-field">
            <span id={selectLabelId}>Producto</span>
            <ProductSelect
              products={products}
              value={candidateId}
              onChange={selectCandidate}
              addedIds={addedIds}
              labelledBy={selectLabelId}
              priceFor={priceFor}
            />
          </div>
          {candidate && (
            <>
              <label>
                Cantidad
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={event => setQuantity(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addCandidate()
                    }
                  }}
                  autoFocus
                />
              </label>
              <button className="primary-button credit-add-button" type="button" onClick={addCandidate}>
                Agregar producto
              </button>
            </>
          )}
          </div>
          <ToastMessage message={message} tone="warning" onClose={() => setMessage('')} />
        </div>
      )}

      <div className="picker-selected-section">
        <h3 className="picker-step-title">Productos seleccionados ({rows.length})</h3>
        {rows.length === 0 && (
          <p className="picker-empty">Aún no agregaste productos.</p>
        )}
      {rows.length > 0 && (
        <div className="table-wrap picker-table-wrap">
          <table className="picker-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, product, unitPrice, subtotal }) => (
                <tr key={item.productId} className={highlightId === String(item.productId) ? 'picker-row-highlight' : ''}>
                  <td>
                    <span className="picker-product-cell">
                      <Thumb product={product} />
                      <span>
                        <strong>{product ? product.name : 'Producto no disponible'}</strong>
                        <span className="table-subtext">{product ? productCode(product) : 'Quítalo para continuar'}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <input
                      ref={element => { rowRefs.current[String(item.productId)] = element }}
                      className="picker-quantity-input"
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={event => changeQuantity(item.productId, event.target.value)}
                      aria-label={`Cantidad de ${product ? product.name : 'producto'}`}
                      required
                    />
                  </td>
                  <td>{money(unitPrice)}</td>
                  <td>{money(subtotal)}</td>
                  <td>
                    <button className="text-button" type="button" onClick={() => removeProduct(item.productId)}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="picker-total-row">
                <td colSpan={3}>Total</td>
                <td>{money(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}
