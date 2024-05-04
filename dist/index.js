"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const serveStatic = require("serve-static");
const load_trial_1 = __importDefault(require("./load-trial"));
const load_trial_2 = require("./load-trial");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(express_1.default.static('public'));
app.use(express_1.default.json({ limit: '512mb' }));
app.use("/css", serveStatic(path_1.default.join(__dirname, "../node_modules/bootstrap/dist/css"), { setHeaders: setMimeType }));
app.use("/js", serveStatic(path_1.default.join(__dirname, "../node_modules/bootstrap/dist/js"), { setHeaders: setMimeType }));
app.set('view engine', 'pug');
app.set('views', 'views');
app.get("/", load_trial_2.getSubjectAndTrialList, (req, res) => {
    res.render('index', { title: 'AOI', message: 'AOI Painter', subjectList: JSON.parse(req.params.subjectList) });
});
app.get("/trial/:subjectId/:trialId", load_trial_1.default, (req, res) => {
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
app.post("/save", load_trial_2.savePointsAOIs, (req, res) => {
    res.send({ ok: true });
});
app.post("/saveCSV", load_trial_2.generateCSV, (req, res) => {
    res.send({ ok: true });
});
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
    console.log(path_1.default.join(__dirname, "../node_modules/bootstrap/dist/js"));
});
function setMimeType(res, path) {
    if (res.getHeader('Content-Type') !== undefined) {
        return;
    }
    const mimeType = serveStatic.mime.lookup(path, 'text/plain');
    res.setHeader('Content-Type', mimeType);
}
