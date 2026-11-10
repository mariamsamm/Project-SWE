import { useMemo } from "react"
import qrcode from "qrcode-generator"

// Renders the ticket code as a scannable QR SVG (no network, no canvas).
function QRCode({ value, label }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M")
    qr.addData(value)
    qr.make()
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })
  }, [value])

  return <div className="qr-code" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />
}

export default QRCode
