import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import serveStatic = require("serve-static");
import getTrial from "./load-trial";
import { savePointsAOIs, getSubjectAndTrialList, generateCSV } from "./load-trial";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json(
    { limit: '1024mb' }
));
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

app.get("/", getSubjectAndTrialList, (req: Request, res: Response) => {
    res.render('index', { title: 'AOI', message: 'AOI Painter', subjectList: JSON.parse(req.params.subjectList)});
});

app.get("/trial/:subjectId/:trialId", getTrial, (req: Request, res: Response) => {
    res.render('trial', {
        title: 'AOI',
        message: 'AOI Painter',
        trial: JSON.parse(req.params.trial),
        subject: JSON.parse(req.params.subject),
        svgPaths: req.params.svgPaths,
        nextSubjectId: req.params.nextSubjectId,
        nextTrialId: req.params.nextTrialId,
        subjectList: JSON.parse(req.params.subjectList)
    });
});

// save points and AOIs
app.post("/save", savePointsAOIs, (req: Request, res: Response) => {
    res.send({ ok: true });
});

app.post("/saveCSV", generateCSV, (req: Request, res: Response) => {
    res.send({ ok: true });
});

app.listen(port, () => {
  console.log(`[server]: Express server started on port ${port}`);
});

function setMimeType(res: Response, path: string) {
    if (res.getHeader('Content-Type') !== undefined) {
        return;
    }
    const mimeType = serveStatic.mime.lookup(path, 'text/plain');
    res.setHeader('Content-Type', mimeType);
}
