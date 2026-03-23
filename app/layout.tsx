import type { Metadata } from 'next'
import { Manrope, Fraunces } from 'next/font/google'
import './globals.css'
import ClawdiaChat from '@/components/ClawdiaChat'
import { APP_NAME } from '@/config/family'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500'],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Family home kiosk',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} antialiased`}>
        {children}
        <ClawdiaChat />
      </body>
    </html>
  )
}
