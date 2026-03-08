import { Oswald, Courier_Prime, Playfair_Display } from 'next/font/google'

export const oswald = Oswald({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-display',
})

export const courierPrime = Courier_Prime({
    subsets: ['latin'],
    weight: ['400', '700'],
    style: ['normal', 'italic'],
    variable: '--font-body',
})

export const playfairDisplay = Playfair_Display({
    subsets: ['latin'],
    weight: ['700', '900'],
    style: ['normal', 'italic'],
    variable: '--font-serif',
})
