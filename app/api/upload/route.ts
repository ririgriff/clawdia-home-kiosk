import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json({ error: 'Cloudinary is not configured' }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  try {
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const dataUri = `data:${file.type || 'image/jpeg'};base64,${base64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'home-kiosk/dishes',
    })

    return NextResponse.json({ url: result.secure_url })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : (err as Record<string, unknown>)?.message as string | undefined
          ?? JSON.stringify(err)
    console.error('[upload] Cloudinary error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
