import { Express } from "express"
import { knex } from "./database"
import { signAndGetPath } from "./imgproxy"

const imgproxyPath =
	process.env.IMGPROXY_PATH || "https://imgproxy.hopefest.co.uk"
const imgBasePath = process.env.IMG_BASE_PATH

export const handleAdmin = (app: Express) => {
	app.post("/admin/hide", async (req, res) => {
		const data = await knex("pictures")
			.select("is_hidden")
			.where({ id: req.body.id })

		await knex("pictures")
			.update({ is_hidden: !data[0].is_hidden })
			.where({ id: req.body.id })

		res.send("Ok")
	})
	app.get("/admin", async (req, res) => {
		const data = await knex("pictures")
			.select("*")
			.orderBy("created_at", "desc")

		const formatted = data.map((x) => {
			return {
				id: x.id,
				src: imgproxyPath + signAndGetPath(`${imgBasePath}${x.file_path}`),
				src320:
					imgproxyPath + signAndGetPath(`${imgBasePath}${x.file_path}`, 320),
				src640:
					imgproxyPath + signAndGetPath(`${imgBasePath}${x.file_path}`, 640),
				src1200:
					imgproxyPath + signAndGetPath(`${imgBasePath}${x.file_path}`, 1200),
				src2048:
					imgproxyPath + signAndGetPath(`${imgBasePath}${x.file_path}`, 2048),
				src3840:
					imgproxyPath + signAndGetPath(`${imgBasePath}${x.file_path}`, 3840),
				isHidden: x.is_hidden,
				createdAt: x.created_at,
			}
		})

		res.send(
			`<html>
        <head>
          <script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossorigin="anonymous"></script>
        </head>
        <body style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))">
          ${formatted
						.map(
							(x) => `
            <div style="display: flex; flex-direction: column;">
              <img style="width: 100%;" src="${x.src320}" />
              <div>
                <input autocomplete="off" type="checkbox" hx-post="/admin/hide" hx-vals='{"id": ${x.id}}' ${x.isHidden ? "checked" : ""} />
                <label>Is Hidden</label>
              </div>
            </div>
          `,
						)
						.join("")}
        </body>
      </html>`,
		)
	})
}
