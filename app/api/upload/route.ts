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

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'home-kiosk/dishes' }, (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve(result as { secure_url: string })
      })
      .end(buffer)
  })

  return NextResponse.json({ url: result.secure_url })
}
