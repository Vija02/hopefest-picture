const crypto = require("crypto")

const KEY = process.env.IMGPROXY_KEY!
const SALT = process.env.IMGPROXY_SALT!

const urlSafeBase64 = (string: string) => {
	return Buffer.from(string)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
}

const hexDecode = (hex: string) => Buffer.from(hex, "hex")

const sign = (salt: string, target: string, secret: string) => {
	const hmac = crypto.createHmac("sha256", hexDecode(secret))
	hmac.update(hexDecode(salt))
	hmac.update(target)
	return urlSafeBase64(hmac.digest())
}

export const signAndGetPath = (url: string) => {
	const encoded_url = urlSafeBase64(url)
	const path = `/rs:fit:400/${encoded_url}`

	const signature = sign(SALT, path, KEY)
	const result = `/${signature}${path}`

	return result
}
