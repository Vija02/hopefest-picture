"use client"

import "@uppy/core/dist/style.min.css"
import "@uppy/dashboard/dist/style.min.css"

import { Box, Heading, Image } from "@chakra-ui/react"
import { Masonry } from "masonic"
import { useState } from "react"
import Uppy from "@uppy/core"
import { Dashboard } from "@uppy/react"
import Tus from "@uppy/tus"

const cats = [
	"https://cdn.pixabay.com/photo/2017/06/12/19/02/cat-2396473__480.jpg",
	"https://cdn.pixabay.com/photo/2015/06/03/13/13/cats-796437__480.jpg",
	"https://cdn.pixabay.com/photo/2012/11/26/13/58/cat-67345__480.jpg",
	"https://cdn.pixabay.com/photo/2014/09/18/20/17/cat-451377__480.jpg",
	"https://cdn.pixabay.com/photo/2015/01/31/12/36/cat-618470__480.jpg",
	"https://cdn.pixabay.com/photo/2014/07/24/18/40/cat-401124__480.jpg",
	"https://cdn.pixabay.com/photo/2014/04/13/20/49/cat-323262__480.jpg",
	"https://cdn.pixabay.com/photo/2015/02/14/10/16/cat-636172__480.jpg",
	"https://cdn.pixabay.com/photo/2013/10/28/14/30/cat-201855__480.jpg",
	"https://cdn.pixabay.com/photo/2015/04/16/15/21/cat-725793__480.jpg",
]

const randomChoice = (items: any[]) => items[Math.floor(Math.random() * items.length)]

let i = 0
// const items = Array.from(Array(5000), () => ({ id: i++ }))

const items = Array.from(Array(5000), () => ({
	id: i++,
	name: "Hi",
	src: randomChoice(cats),
}))

const EasyMasonryComponent = () => (
	<Masonry items={items} columnGutter={8} render={FakeCard} />
)

const FakeCard = ({ data: { id, name, src } }) => (
	<div>
		<img src={src} />
	</div>
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
