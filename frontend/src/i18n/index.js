import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      nav: {
        orders: "ORDERS",
        supplierTracking: "SUPPLIER TRACKING",
        receivingHistory: "RECEIVING HISTORY",
        readyToDispatch: "READY TO DISPATCH",
        shipmentMovement: "SHIPMENT MOVEMENT",
        customers: "CUSTOMERS",
        quotes: "QUOTES",
        quotesGenerate: "GENERATE",
        quotesHistory: "HISTORY",
      }
    }
  },
  es: {
    translation: {
      nav: {
        orders: "ÓRDENES",
        supplierTracking: "TRACKING DE PROVEEDOR",
        receivingHistory: "HISTORIAL DE RECEPCIÓN",
        readyToDispatch: "LISTO PARA DESPACHAR",
        shipmentMovement: "MOVIMIENTO DE ENVÍO",
        customers: "CLIENTES",
        quotes: "COTIZACIONES",
        quotesGenerate: "GENERAR",
        quotesHistory: "HISTORIAL",
      }
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    interpolation: { escapeValue: false }
  })

export default i18n
