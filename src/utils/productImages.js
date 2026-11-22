import pinataImage from '../assets/product-pinata.jpg'
import balloonsPackImage from '../assets/product-balloons-pack.jpg'
import balloonsThemeImage from '../assets/product-balloons-theme.jpg'
import plushiesImage from '../assets/product-plushies.jpg'
import tentImage from '../assets/product-tent.jpg'
import prizesImage from '../assets/product-prizes.jpg'
import utensilsImage from '../assets/product-utensils.jpg'
import dessertStandImage from '../assets/product-dessert-stand.jpg'

const imageRules = [
  { terms: ['200 globos'], image: balloonsPackImage },
  { terms: ['12 globos', 'temáticos', 'tematicos'], image: balloonsThemeImage },
  { terms: ['peluches'], image: plushiesImage },
  { terms: ['carpa'], image: tentImage },
  { terms: ['premios'], image: prizesImage },
  { terms: ['utensilios', 'vasos', 'platos'], image: utensilsImage },
  { terms: ['postres', 'estante'], image: dessertStandImage },
  { terms: ['unicornio', 'piñata'], image: pinataImage }
]

export function productCode(product) {
  return product.code || `DAYU-${String(product.id || 0).padStart(4, '0')}`
}

export function localImage(product) {
  const text = `${product.name || ''} ${product.description || ''}`.toLowerCase()
  const match = imageRules.find(rule => rule.terms.some(term => text.includes(term)))
  return match?.image || pinataImage
}

export function productImage(product) {
  return product.imageUrl || localImage(product)
}
