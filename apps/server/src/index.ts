import bodyParser from "body-parser"
import cors from "cors"
import express from "express"
import Knex from "knex"
import knexfile from "../knexfile"

const knex = Knex(knexfile)

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(bodyParser.json())

app.get("/health", (req, res) => {
	res.status(200).send("Ok")
})

app.get("/pictures", async (req, res) => {
	const data = await knex("pictures").select("*")
	console.log(data)

	res.json([])
})

// app.post("/sendCommand", async (req, res) => {
// 	const socket = sessionManager[req.body.sessionId]
// 	if (!!socket && !!req.body.command) {
// 		socket.send(req.body.command)
// 		sessionLogs[req.body.sessionId].push({
// 			direction: "out",
// 			message: req.body.command,
// 		})
// 	}

// 	res.json({ success: true })
// })

app.listen(port, () => {
	console.log(new Date(), `Server Listening on port ${port}`)
})
