"use client"

import type React from "react"
import { useCallback, useMemo, useRef, useState } from "react"
import jsQR from "jsqr"
import QRCode from "qrcode"

type DecodeState =
  | { status: "idle" }
  | { status: "decoding" }
  | { status: "success"; data: string }
  | { status: "error"; message: string }

function isProbablyUrl(text: string) {
  try {
    const url = new URL(text)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export default function QRImageDecoder() {
  // Colors use theme tokens: primary, secondary, destructive, muted
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [state, setState] = useState<DecodeState>({ status: "idle" })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [editableText, setEditableText] = useState<string>("")
  const [generatedQrUrl, setGeneratedQrUrl] = useState<string | null>(null)

  const resetPreviewUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  const clearAll = useCallback(() => {
    resetPreviewUrl()
    setImagePreview(null)
    setState({ status: "idle" })
    setEditableText("") // reset edited text
    setGeneratedQrUrl(null) // reset generated QR
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.type.startsWith("image/")) {
      setState({ status: "error", message: "Please select an image file." })
      return
    }

    setState({ status: "decoding" })
    resetPreviewUrl()
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setImagePreview(url)

    try {
      const data = await decodeQrFromImageUrl(url, canvasRef)
      if (!data) {
        setState({
          status: "error",
          message: "No QR code found in this image. Try a clearer or higher-contrast image.",
        })
        setEditableText("") //
      } else {
        setState({ status: "success", data })
        setEditableText(data) // seed textarea with decoded content
        setGeneratedQrUrl(null) // clear any previous generated QR
      }
    } catch (err) {
      console.error("[v0] QR decoding error:", err)
      setState({
        status: "error",
        message: "Failed to decode the QR code. Please try another image.",
      })
      setEditableText("") //
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      e.stopPropagation()
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
    },
    [handleFiles],
  )

  const canCopy = useMemo(() => state.status === "success" && !!editableText, [state, editableText])

  const copyResult = useCallback(async () => {
    if (state.status !== "success" || !editableText) return
    try {
      await navigator.clipboard.writeText(editableText)
    } catch (e) {
      console.error("[v0] clipboard error:", e)
    }
  }, [state, editableText])

  const generateQR = useCallback(async () => {
    if (!editableText?.trim()) {
      setGeneratedQrUrl(null)
      return
    }
    try {
      // tune options for readability while keeping file small
      const url = await QRCode.toDataURL(editableText, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
        color: { dark: "#000000", light: "#ffffff" },
      })
      setGeneratedQrUrl(url)
    } catch (e) {
      console.error("[v0] QR generation error:", e)
      setGeneratedQrUrl(null)
    }
  }, [editableText])

  return (
    <section aria-label="QR image uploader and decoder" className="flex flex-col gap-6">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={onDrop}
        htmlFor="qr-image-input"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-8 text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click()
          }
        }}
      >
        <span className="text-sm font-medium">Drag & drop an image here</span>
        <span className="text-xs text-muted-foreground">or click to select a file</span>
        <input
          id="qr-image-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="sr-only"
        />
      </label>

      {imagePreview && (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-md border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview || "/placeholder.svg?height=320&width=480&query=Uploaded%20image%20preview"}
              alt="Uploaded QR preview"
              className="w-full h-auto"
            />
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="self-start rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs px-3 py-1.5 transition-colors"
          >
            Clear image
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="rounded-lg border border-border p-4 bg-card">
        <h2 className="text-sm font-medium mb-2">Decoded result</h2>

        {state.status === "idle" && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upload an image to see the decoded content here.
          </p>
        )}

        {state.status === "decoding" && <p className="text-sm text-foreground/80">Decoding QR code…</p>}

        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

        {state.status === "success" && (
          <div className="flex flex-col gap-3">
            <label htmlFor="decoded-text" className="text-xs text-muted-foreground">
              Edit decoded text
            </label>
            <textarea
              id="decoded-text"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-2 text-sm leading-relaxed"
              placeholder="Decoded text will appear here…"
            />

            {/* Optional helper showing if it looks like a URL */}
            {editableText && isProbablyUrl(editableText) && (
              <a
                href={editableText}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-primary underline underline-offset-2"
              >
                Open as link
              </a>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyResult}
                className="rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 transition-colors"
                aria-disabled={!canCopy}
              >
                Copy
              </button>

              <button
                type="button"
                onClick={generateQR}
                className="rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs px-3 py-1.5 transition-colors"
              >
                Generate QR
              </button>

              {generatedQrUrl && (
                <a
                  href={generatedQrUrl}
                  download="qr.png"
                  className="rounded-md bg-muted hover:bg-muted/80 text-foreground text-xs px-3 py-1.5 transition-colors"
                >
                  Download PNG
                </a>
              )}
            </div>

            {generatedQrUrl && (
              <div className="mt-1 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedQrUrl || "/placeholder.svg"}
                  alt="Generated QR code preview"
                  className="h-40 w-40 border border-border rounded-md bg-white p-2"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This QR encodes your edited text. Test by scanning before sharing.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Tips />
    </section>
  )
}

function Tips() {
  return (
    <div className="rounded-lg border border-border p-4 bg-muted/40">
      <h3 className="text-sm font-medium mb-2">Tips for better results</h3>
      <ul className="list-disc pl-5 text-xs text-muted-foreground leading-relaxed">
        <li>Use a clear, well-lit image with the QR code in focus.</li>
        <li>Crop unnecessary borders if the QR is very small in the photo.</li>
        <li>High-contrast black-and-white codes decode more reliably.</li>
      </ul>
    </div>
  )
}

/**
 * Decode a QR code from an image URL using jsQR by drawing to a canvas and reading pixel data.
 */
async function decodeQrFromImageUrl(url: string, canvasRef: React.RefObject<HTMLCanvasElement>) {
  const img = await loadImage(url)
  const { width, height } = fitWithin(img.width, img.height, 1024, 1024)

  const canvas = canvasRef.current || document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas rendering context not available")

  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const code = jsQR(imageData.data, width, height, {
    inversionAttempts: "attemptBoth",
  })

  return code?.data ?? null
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = url
  })
}

function fitWithin(srcW: number, srcH: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / srcW, maxH / srcH, 1)
  return { width: Math.floor(srcW * scale), height: Math.floor(srcH * scale) }
}
