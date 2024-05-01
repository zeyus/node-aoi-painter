import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import serveStatic = require("serve-static");

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(
    "/css",
    serveStatic(
        path.join(__dirname, "../node_modules/bootstrap/dist/css"),
        { setHeaders: setMimeType }
    )
);
app.use(
    "/js",
    serveStatic(
        path.join(__dirname, "../node_modules/bootstrap/dist/js"),
        { setHeaders: setMimeType }
    )
);
app.set('view engine', 'pug');
app.set('views', 'views');

app.get("/", (req: Request, res: Response) => {
    res.render('index', { title: 'Hey', message: 'Hello there!' });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  console.log(path.join(__dirname, "../node_modules/bootstrap/dist/js"));
});

function setMimeType(res: Response, path: string) {
    if (res.getHeader('Content-Type') !== undefined) {
        return;
    }
    const mimeType = serveStatic.mime.lookup(path, 'text/plain');
    res.setHeader('Content-Type', mimeType);
}