import { knex } from "./database"
import sharp from "sharp"
import axios from "axios"
import sizeOf from "image-size"
import exifr from "exifr"
import AWS from "aws-sdk"

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	endpoint: process.env.AWS_S3_ENDPOINT,
})

const widthSettings = [320, 640, 1200, 2048, 3840]
const imgBasePath = process.env.IMG_BASE_PATH

export const cacheData = async (filePath: string) => {
	const data = await knex("pictures").select("*").where({ file_path: filePath })

	const x = data[0]

	try {
		const url = `${imgBasePath}${x.file_path}`

		const fileSplit = x.file_path.split(".")
		const fileName = fileSplit[0]
		const fileExtension = fileSplit[1]

		const response = await axios.get(url, { responseType: "arraybuffer" })
		const buffer = Buffer.from(response.data)
		const exif = await exifr.parse(buffer)
		const exifDateTime = exif?.DateTimeOriginal ?? null

		const size = sizeOf(buffer)

		let theWidth = size.width
		let theHeight = size.height
		if (size.orientation !== undefined && size.orientation >= 5) {
			theWidth = size.height
			theHeight = size.width
		}

		await knex("pictures")
			.update({
				width: theWidth,
				height: theHeight,
				exif_created_at: exifDateTime ? new Date(exifDateTime) : null,
			})
			.where({ id: x.id })

		for (const width of widthSettings) {
			if (theWidth && width < theWidth) {
				const newImage = await sharp(buffer)
					.rotate()
					.resize(width)
					.withMetadata()
					.toBuffer()

				await s3
					.upload({
						Bucket: process.env.AWS_S3_BUCKET_NAME ?? "",
						Key: `${fileName}-${width}.${fileExtension}`,
						Body: newImage,
					})
					.promise()
			}
		}
		await knex("pictures").update({ is_cached: true }).where({ id: x.id })
	} catch (e) {
		console.error(e)
	}
}
