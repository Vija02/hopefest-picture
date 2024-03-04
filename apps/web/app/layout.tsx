import "./globals.scss"

import { ChakraProvider } from "@chakra-ui/react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: "HF24 Gallery",
	description: "Picture gallery of Hope Fest 2024",
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}): JSX.Element {
	return (
		<html lang="en">
			<ChakraProvider>
				<body className={inter.className}>{children}</body>
			</ChakraProvider>
		</html>
	)
}
