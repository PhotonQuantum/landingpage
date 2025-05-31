// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { appendResponseHeader, eventHandler, sendWebResponse } from "vinxi/http";
import crypto from "crypto";

const app = () => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
)

const h = createHandler(app, { mode: "async" })

export default eventHandler(async (e) => {
  const body = await h(e)
  if (typeof body !== "string") {
    return body
  }

  // Compute a weak ETag using SHA-1 hash of the body
  const etag = 'W/"' + crypto.createHash("sha1").update(body).digest("base64") + '"';
  const IfNoneMatch = e.web?.request?.headers.get("If-None-Match");
  if (IfNoneMatch === etag) {
    return sendWebResponse(e, new Response(null, {
      status: 304,
      headers: {
        "ETag": etag
      }
    }))
  }

  appendResponseHeader(e, "ETag", etag)
  return body
});
