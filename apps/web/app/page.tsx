"use client"

import "@uppy/core/dist/style.min.css"
import "@uppy/dashboard/dist/style.min.css"
import "yet-another-react-lightbox/styles.css"
import "yet-another-react-lightbox/plugins/counter.css"

import { Box, Heading, Image } from "@chakra-ui/react"
import { Masonry } from "masonic"
import { useCallback, useEffect, useState } from "react"
import Uppy from "@uppy/core"
import { Dashboard } from "@uppy/react"
import Tus from "@uppy/tus"
import axios from "axios"
import Lightbox from "yet-another-react-lightbox"
import Download from "yet-another-react-lightbox/plugins/download"
import Counter from "yet-another-react-lightbox/plugins/counter"
import Slideshow from "yet-another-react-lightbox/plugins/slideshow"
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen"
import { create } from "zustand"

interface SlideStoreState {
	slideIndex: number
	slideIsOpen: boolean
	closeSlide: () => void
	openSlide: (slideIndex: number) => void
	setSlideIndex: (slideIndex: number) => void
}
const useSlideStore = create<SlideStoreState>((set) => ({
	slideIndex: 0,
	slideIsOpen: false,
	closeSlide: () => set({ slideIsOpen: false }),
	openSlide: (slideIndex: number) => set({ slideIndex, slideIsOpen: true }),
	setSlideIndex: (slideIndex: number) => set({ slideIndex }),
}))

const EasyMasonryComponent = ({ data }: any) => {
	return <Masonry items={data} columnGutter={8} render={ImgRenderer} />
}

const ImgRenderer = (props: any) => {
	const {
		index,
		data: { id, src, src320, src640, src1200, src2048, src3840 },
		width,
	} = props

	const openSlide = useSlideStore((state) => state.openSlide)

	return (
		<Image
			id={id}
			src={src}
			alt=""
			onClick={() => openSlide(index)}
			cursor="pointer"
			sizes={`${width}px`}
			srcSet={`${src320} 320w, ${src640} 640w, ${src1200} 1200w, ${src2048} 2048w, ${src3840} 3840w`}
		/>
	)
}

const Upload = ({ getPics }: { getPics: () => void }) => {
	const [uppy] = useState(() =>
		new Uppy({ restrictions: { allowedFileTypes: ["image/*"] } }).use(Tus, {
			endpoint:
				process.env.NEXT_PUBLIC_TUSD_PATH ||
				"https://tusd.hopefest.co.uk/files/",
		}),
	)

	useEffect(() => {
		uppy.on("complete", () => {
			getPics()
		})
	}, [])

	return <Dashboard uppy={uppy} plugins={[]} />
}

const LightBoxComponent = ({ data }: any) => {
	const slideState = useSlideStore()

	return (
		<Lightbox
			open={slideState.slideIsOpen}
			index={slideState.slideIndex}
			close={() => slideState.closeSlide()}
			on={{
				view: ({ index: currentIndex }) =>
					slideState.setSlideIndex(currentIndex),
			}}
			slides={data.map((x: any) => ({
				src: x.src,
				srcSet: [
					{ src: x.src320, width: 320 },
					{ src: x.src640, width: 640 },
					{ src: x.src1200, width: 1200 },
					{ src: x.src2048, width: 2048 },
					{ src: x.src3840, width: 3840 },
				],
			}))}
			plugins={[Counter, Download, Fullscreen, Slideshow]}
		/>
	)
}

export default function Page(): JSX.Element {
	const [data, setData] = useState([])

	const getPics = useCallback(() => {
		axios.get("/pictures").then((res) => {
			setData(res.data)
		})
	}, [])

	useEffect(() => {
		getPics()
	}, [])

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
				<Heading fontSize="xl">HOPE FEST UK 2024 Gallery</Heading>
			</Box>
			<Box
				bgColor="white"
				maxW={1210}
				margin="auto"
				px={{ base: "8px", md: "16px" }}
				py="16px"
				boxShadow="md"
			>
				<Upload getPics={getPics} />
				<Box mb={4} />
				<EasyMasonryComponent data={data} />
			</Box>
			<LightBoxComponent data={data} />
		</Box>
	)
}
