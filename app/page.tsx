import QRImageDecoder from "@/components/qr-image-decoder"

export default function Page() {
  return (
    <main className="min-h-dvh bg-background text-foreground px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-balance">QR Code Decoder</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Upload or drag-and-drop an image containing a QR code. Decoding happens locally in your browser.
          </p>
        </header>

        <QRImageDecoder />

        <footer className="mt-12 text-center text-xs text-muted-foreground">No data leaves your device.</footer>
      </div>
    </main>
  )
}
