"use client"

import "@uppy/core/dist/style.min.css"
import "@uppy/dashboard/dist/style.min.css"

import { Box, Heading, Image } from "@chakra-ui/react"
import { Masonry } from "masonic"
import { useEffect, useState } from "react"
import Uppy from "@uppy/core"
import { Dashboard } from "@uppy/react"
import Tus from "@uppy/tus"
import axios from "axios"

const EasyMasonryComponent = () => {
	const [data, setData] = useState([])
	useEffect(() => {
		axios.get("/pictures").then((res) => {
			setData(res.data)
		})
	}, [])

	return <Masonry items={data} columnGutter={8} render={ImgRenderer} />
}

const ImgRenderer = ({ data: { id, smallSizeSrc } }: any) => (
	<img id={id} src={smallSizeSrc} alt="" />
)

const Upload = () => {
	const [uppy] = useState(() =>
		new Uppy().use(Tus, {
			endpoint:
				process.env.NODE_ENV === "development"
					? "http://localhost:8080/files/"
					: "https://tusd.hopefest.co.uk/files/",
		}),
	)

	return <Dashboard uppy={uppy} plugins={[]} />
}

export default function Page(): JSX.Element {
	return (
		<Box bgColor="#F0F2F5">
			<Box
				bgColor="gray.800"
				px={2}
				py={2}
				textAlign="center"
				color="gray.100"
				pb={8}
				mb={4}
			>
				<Image
					display="block"
					mx="auto"
					marginBottom="-20px"
					src="https://hopefest.co.uk/images/hf24_logo_white.svg"
					alt=""
					height="140px"
					marginLeft="-5px"
				/>
				<Heading fontSize="xl">HOPE FEST UK 2024</Heading>
			</Box>
			<Box
				bgColor="white"
				maxW={1210}
				margin="auto"
				px={{ base: "8px", md: "16px" }}
				py="16px"
				boxShadow="md"
			>
				<Upload />

				<EasyMasonryComponent />
			</Box>
		</Box>
	)
}
