"use strict";
// express middleware module to load a trial from the csv file
// and store it in the request object
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCSV = exports.getSubjectAndTrialList = exports.savePointsAOIs = void 0;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// setup sqlite3 database
function openDb() {
    return __awaiter(this, void 0, void 0, function* () {
        return new better_sqlite3_1.default('./data/animalfeatures_points.db');
    });
}
let db;
const csvPath = path_1.default.join(__dirname, `../data/animalfeatures_2024-04-26_points.csv`);
function createDBSchema() {
    return __awaiter(this, void 0, void 0, function* () {
        db.exec("CREATE TABLE IF NOT EXISTS subjects (prolific_id TEXT PRIMARY KEY, condition TEXT, input_device TEXT, drawing_skills INTEGER)");
        db.exec("CREATE TABLE IF NOT EXISTS trials (prolific_id TEXT, trial INTEGER, animal TEXT, action TEXT, stim_img TEXT, drawing_time INTEGER, start_timestamp TEXT, end_timestamp TEXT, completed BOOLEAN, browser TEXT, browser_version TEXT, os TEXT, os_version TEXT, device TEXT, device_brand TEXT, device_model TEXT, window_width INTEGER, window_height INTEGER, orientation TEXT, aois_saved BOOLEAN)");
        db.exec("CREATE TABLE IF NOT EXISTS paths (prolific_id TEXT, trial INTEGER, path_id INTEGER)");
        db.exec("CREATE TABLE IF NOT EXISTS points (prolific_id TEXT, trial INTEGER, path_id INTEGER, point_id INTEGER, x INTEGER, y INTEGER, aoi TEXT)");
        // create indices
        db.exec("CREATE INDEX IF NOT EXISTS idx_subjects_prolific_id ON subjects(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_trials_prolific_id ON trials(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_trials_trial ON trials(trial)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_paths_prolific_id ON paths(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_paths_trial ON paths(trial)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_prolific_id ON points(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_trial ON points(trial)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_path_id ON points(path_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_point_id ON points(point_id)");
        // update AOIs set to 0 where null
        db.exec("UPDATE trials SET aois_saved = 0 WHERE aois_saved IS NULL");
    });
}
function loadCsv() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('loading csv');
        const subjects = {
            n: 0,
            ids: [],
        };
        return new Promise((resolve, reject) => {
            fs_1.default.createReadStream(csvPath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                const subjectId = data.prolific_id;
                if (!subjects[`s${subjectId}`]) {
                    subjects[`s${subjectId}`] = {
                        participant_code: data.participant_code,
                        prolific_id: data.prolific_id,
                        condition: data.condition,
                        input_device: data.input_device,
                        drawing_skills: data.drawing_skills,
                        n: 0,
                        trial_ids: [],
                    };
                    subjects.n++;
                    subjects.ids.push(`${subjectId}`);
                }
                const subject = subjects[`s${subjectId}`];
                const trialId = data.trial;
                if (!subject[trialId]) {
                    subject[trialId] = {
                        prolific_id: data.prolific_id,
                        trial: data.trial,
                        animal: data.animal,
                        action: data.action,
                        aois_saved: 0,
                        stim_img: data.stim_img,
                        drawing_time: data.drawing_time,
                        start_timestamp: data.start_timestamp,
                        end_timestamp: data.end_timestamp,
                        completed: data.completed,
                        browser: data.browser,
                        browser_version: data.browser_version,
                        os: data.os,
                        os_version: data.os_version,
                        device: data.device,
                        device_brand: data.device_brand,
                        device_model: data.device_model,
                        window_width: data.window_width,
                        window_height: data.window_height,
                        orientation: data.orientation,
                        n: 0,
                    };
                    subject.n++;
                    subject.trial_ids.push(trialId);
                }
                const trial = subject[trialId];
                const path_id = data.path_id;
                if (!trial[path_id]) {
                    trial[path_id] = {
                        prolific_id: data.prolific_id,
                        trial: data.trial,
                        path_id: data.path_id,
                        n: 0,
                    };
                    trial.n++;
                }
                const path = trial[path_id];
                const point = {
                    prolific_id: data.prolific_id,
                    trial: data.trial,
                    path_id: data.path_id,
                    x: data.x,
                    y: data.y,
                    point_id: data.point_id,
                    aoi: "",
                };
                path[data.point_id] = point;
                path.n++;
            })
                .on('end', () => {
                console.log('CSV file successfully processed');
                resolve(subjects);
            });
        });
    });
}
let subjects = {
    n: 0,
    ids: [],
};
function addSubjects(subject) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("INSERT INTO subjects (prolific_id, condition, input_device, drawing_skills) VALUES (@prolific_id, @condition, @input_device, @drawing_skills)");
        const insertMany = db.transaction((subject) => {
            for (const s of subject) {
                stmt.run({
                    prolific_id: s.prolific_id,
                    condition: s.condition,
                    input_device: s.input_device,
                    drawing_skills: s.drawing_skills,
                });
            }
        });
        insertMany(subject);
    });
}
function addTrials(trial) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare(`INSERT INTO
            trials
                (
                    prolific_id,
                    trial,
                    animal,
                    action,
                    stim_img,
                    drawing_time,
                    start_timestamp,
                    end_timestamp,
                    completed,
                    browser,
                    browser_version,
                    os,
                    os_version,
                    device,
                    device_brand,
                    device_model,
                    window_width,
                    window_height,
                    orientation
                )
                VALUES 
                (
                    @prolific_id,
                    @trial,
                    @animal,
                    @action,
                    @stim_img,
                    @drawing_time,
                    @start_timestamp,
                    @end_timestamp,
                    @completed,
                    @browser,
                    @browser_version,
                    @os,
                    @os_version,
                    @device,
                    @device_brand,
                    @device_model,
                    @window_width,
                    @window_height,
                    @orientation
                )`);
        const insertMany = db.transaction((trial) => {
            for (const t of trial) {
                stmt.run({
                    prolific_id: t.prolific_id,
                    trial: t.trial,
                    animal: t.animal,
                    action: t.action,
                    stim_img: t.stim_img,
                    drawing_time: t.drawing_time,
                    start_timestamp: t.start_timestamp,
                    end_timestamp: t.end_timestamp,
                    completed: t.completed,
                    browser: t.browser,
                    browser_version: t.browser_version,
                    os: t.os,
                    os_version: t.os_version,
                    device: t.device,
                    device_brand: t.device_brand,
                    device_model: t.device_model,
                    window_width: t.window_width,
                    window_height: t.window_height,
                    orientation: t.orientation,
                });
            }
        });
        insertMany(trial);
    });
}
function addPath(paths) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("INSERT INTO paths (prolific_id, trial, path_id) VALUES (@prolific_id, @trial, @path_id)");
        const insertMany = db.transaction((paths) => {
            for (const p of paths) {
                stmt.run({ prolific_id: p.prolific_id, trial: p.trial, path_id: p.path_id });
            }
        });
        insertMany(paths);
    });
}
function addPoints(point) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("INSERT INTO points (prolific_id, trial, path_id, point_id, x, y, aoi) VALUES (@prolific_id, @trial, @path_id, @point_id, @x, @y, @aoi)");
        const insertMany = db.transaction((point) => {
            for (const p of point) {
                stmt.run({ prolific_id: p.prolific_id, trial: p.trial, path_id: p.path_id, point_id: p.point_id, x: p.x, y: p.y, aoi: p.aoi });
            }
        });
        insertMany(point);
    });
}
function buildSubjectsFromDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM subjects");
        const subjs = stmt.all();
        subjs.forEach((row) => {
            const subjectId = row.prolific_id;
            subjects[`s${subjectId}`] = {
                participant_code: row.participant_code,
                prolific_id: row.prolific_id,
                condition: row.condition,
                input_device: row.input_device,
                drawing_skills: row.drawing_skills,
                n: 0,
                trial_ids: [],
            };
            subjects.n++;
            subjects.ids.push(`${subjectId}`);
        });
    });
}
function buildTrialsFromDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM trials");
        const trials = stmt.all();
        trials.forEach((row) => {
            const subjectId = row.prolific_id;
            const trialId = row.trial;
            if (!subjects[`s${subjectId}`][trialId]) {
                subjects[`s${subjectId}`][trialId] = {
                    prolific_id: row.prolific_id,
                    trial: row.trial,
                    animal: row.animal,
                    action: row.action,
                    aois_saved: row.aois_saved,
                    stim_img: row.stim_img,
                    drawing_time: row.drawing_time,
                    start_timestamp: row.start_timestamp,
                    end_timestamp: row.end_timestamp,
                    completed: row.completed,
                    browser: row.browser,
                    browser_version: row.browser_version,
                    os: row.os,
                    os_version: row.os_version,
                    device: row.device,
                    device_brand: row.device_brand,
                    device_model: row.device_model,
                    window_width: row.window_width,
                    window_height: row.window_height,
                    orientation: row.orientation,
                    n: 0,
                };
                subjects[`s${subjectId}`].n++;
                subjects[`s${subjectId}`].trial_ids.push(trialId);
            }
        });
    });
}
function buildPathsFromDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM paths");
        const paths = stmt.all();
        paths.forEach((row) => {
            const subjectId = row.prolific_id;
            const trialId = row.trial;
            const pathId = row.path_id;
            if (!subjects[`s${subjectId}`][trialId][pathId]) {
                subjects[`s${subjectId}`][trialId][pathId] = {
                    prolific_id: row.prolific_id,
                    trial: row.trial,
                    path_id: row.path_id,
                    n: 0,
                };
                subjects[`s${subjectId}`][trialId].n++;
            }
        });
    });
}
function buildPointsFromDB() {
    return __awaiter(this, arguments, void 0, function* (force = false) {
        const stmt = db.prepare("SELECT * FROM points");
        const points = stmt.all();
        points.forEach((row) => {
            const subjectId = row.prolific_id;
            const trialId = row.trial;
            const pathId = row.path_id;
            const pointId = row.point_id;
            // console.log(subjectId, trialId, pathId, pointId);
            if (!subjects[`s${subjectId}`][trialId][pathId][pointId] || force) {
                subjects[`s${subjectId}`][trialId][pathId][pointId] = {
                    prolific_id: row.prolific_id,
                    trial: row.trial,
                    path_id: row.path_id,
                    x: row.x,
                    y: row.y,
                    point_id: row.point_id,
                    aoi: row.aoi,
                };
                subjects[`s${subjectId}`][trialId][pathId].n++;
            }
        });
    });
}
function buildPointsForTrialFromDB(prolific_id, trial) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM points WHERE prolific_id = @prolific_id AND trial = @trial");
        const points = stmt.all({ prolific_id: prolific_id, trial: trial });
        const subject = subjects[`s${prolific_id}`];
        const t = subject[trial];
        const paths = {};
        for (const p of points) {
            const pathId = p.path_id;
            // if the path isn't in paths, we need to reset n
            if (!paths[pathId]) {
                paths[pathId] = true;
                t[pathId].n = 0;
            }
            const pointId = p.point_id;
            t[pathId][pointId] = {
                prolific_id: p.prolific_id,
                trial: p.trial,
                path_id: p.path_id,
                x: p.x,
                y: p.y,
                point_id: p.point_id,
                aoi: p.aoi,
            };
            t[pathId].n++;
        }
    });
}
openDb().then((database) => {
    db = database;
    db.pragma('journal_mode = WAL');
    console.log('db opened');
    createDBSchema().then(() => {
        console.log('db schema created');
        // first try to build the subjects from the database
        buildSubjectsFromDB().then(() => {
            console.log('subjects built from db');
            buildTrialsFromDB().then(() => {
                console.log('trials built from db');
                buildPathsFromDB().then(() => {
                    console.log('paths built from db');
                    buildPointsFromDB().then(() => {
                        console.log('points built from db');
                        // if no subjects are found in the database, load them from the csv file
                        if (subjects.n === 0) {
                            console.log('no subjects found in db, loading from csv');
                            loadCsv().then((data) => {
                                subjects = data;
                            }).then(() => {
                                const subjectArray = subjects.ids.map((id) => subjects[`s${id}`]);
                                addSubjects(subjectArray).then(() => {
                                    console.log('subjects added to db');
                                    const trialArray = subjects.ids.flatMap((id) => subjects[`s${id}`].trial_ids.map((tid) => subjects[`s${id}`][tid]));
                                    addTrials(trialArray).then(() => {
                                        console.log('trials added to db');
                                        const pathArray = trialArray.flatMap((t) => Object.values(t).filter((p) => p.path_id !== undefined));
                                        addPath(pathArray).then(() => {
                                            console.log('paths added to db');
                                            // we know the numeric keys are the points
                                            const pointArray = pathArray.flatMap((p) => Object.values(p).filter((p) => p.x !== undefined));
                                            addPoints(pointArray).then(() => {
                                                console.log('points added to db');
                                            });
                                        });
                                    });
                                });
                            });
                        }
                    });
                });
            });
        });
    });
});
const getTrial = (req, res, next) => {
    const subjectId = req.params.subjectId;
    const trialId = parseInt(req.params.trialId);
    if (subjects[`s${subjectId}`]) {
        const subject = subjects[`s${subjectId}`];
        const trial = subject[trialId];
        if (trial) {
            // set next trial and / or subject
            let nextSubjectId = subjectId;
            // get the next trial from subject.trial_ids
            const nextTrialIndex = subject.trial_ids.indexOf(trialId) + 1;
            if (nextTrialIndex <= subject.trial_ids.length) {
                req.params.nextTrialId = `${subject.trial_ids[nextTrialIndex]}`;
            }
            else {
                // get the next subject
                const nextSubjectIndex = subjects.ids.indexOf(subjectId) + 1;
                if (nextSubjectIndex <= subjects.ids.length) {
                    nextSubjectId = subjects.ids[nextSubjectIndex];
                    req.params.nextTrialId = `${subjects[`s${nextSubjectId}`].trial_ids[0]}`;
                }
                else {
                    nextSubjectId = "";
                    req.params.nextTrialId = "";
                }
            }
            req.params.nextSubjectId = nextSubjectId;
            console.log('trial found');
            req.params.trial = JSON.stringify(trial);
            req.params.subject = JSON.stringify(subject);
            req.params.svgPaths = svgPathsFromTrial(trial);
            req.params.subjectList = JSON.stringify(subjectList());
            next();
        }
        else {
            res.status(404).send('Trial not found');
        }
    }
    else {
        res.status(404).send('Subject not found');
    }
};
const aoiColors = {
    "head": "red",
    "torso": "blue",
    "legs": "green",
    "": "black",
};
const svgPathsFromTrial = (trial, strokeWidth = 2, strokeColor = "black", fillColor = "none") => {
    const n_paths = trial.n;
    let svgPaths = "";
    const pathTemplate = (pointString, strokeColor = "black", aoi = "") => `<path d="${pointString}" stroke="${strokeColor}" stroke-linecap="round" stroke-width="${strokeWidth}" fill="${fillColor}" data-aoi="${aoi}" />`;
    for (let i = 1; i <= n_paths; i++) {
        const path = trial[i];
        const n_points = path.n;
        let pointArray = [];
        let currentAoi = "";
        for (let j = 1; j <= n_points; j++) {
            if (j === 1 || path[j].aoi !== currentAoi) {
                currentAoi = path[j].aoi;
                pointArray.push({ d: `M${path[j].x} ${path[j].y}`, aoi: currentAoi });
            }
            else {
                // add to "d" of the last point
                pointArray[pointArray.length - 1].d += ` L${path[j].x} ${path[j].y}`;
            }
        }
        for (const p of pointArray) {
            svgPaths += pathTemplate(p.d, aoiColors[p.aoi], p.aoi);
        }
    }
    return svgPaths;
};
const savePointsAOIs = (req, res, next) => {
    const points = req.body.points;
    const prolific_id = req.body.prolific_id;
    const trial = req.body.trial;
    // reset ALL point AOIs for this trial
    console.log('resetting all points for trial: ', trial, ' for subject: ', prolific_id);
    const resetstmt = db.prepare("UPDATE points SET aoi = '' WHERE prolific_id = @prolific_id AND trial = @trial");
    resetstmt.run({ prolific_id: prolific_id, trial: trial });
    console.log('points reset');
    console.log('saving points');
    const stmt = db.prepare("UPDATE points SET aoi = @aoi WHERE prolific_id = @prolific_id AND trial = @trial AND path_id = @path_id AND point_id = @point_id");
    const updateMany = db.transaction((points) => {
        for (const p of points) {
            stmt.run({ prolific_id: prolific_id, trial: trial, path_id: p.path_id, point_id: p.point_id, aoi: p.aoi });
        }
    });
    updateMany(points);
    console.log('points saved, rebuilding cache');
    buildPointsForTrialFromDB(prolific_id, trial).then(() => {
        console.log('cache rebuilt');
    });
    console.log('marking trial as having AOIs saved');
    const updatestmt = db.prepare("UPDATE trials SET aois_saved = 1 WHERE prolific_id = @prolific_id AND trial = @trial");
    updatestmt.run({ prolific_id: prolific_id, trial: trial });
    // update the subject cache
    subjects[`s${prolific_id}`][trial].aois_saved = 1;
    next();
};
exports.savePointsAOIs = savePointsAOIs;
function subjectList() {
    // just return a nested array of subject ids and trial ids and aois_saved
    // if all of a subject's trials have aois_saved, then the subject is marked as complete
    const subjectsTrials = [];
    for (const s of subjects.ids) {
        const subject = subjects[`s${s}`];
        const subjectTrials = [];
        let complete = true;
        let completed = 0;
        for (const t of subject.trial_ids) {
            const trial = subject[t];
            subjectTrials.push({ trial: t, aois_saved: trial.aois_saved });
            if (trial.aois_saved === 0) {
                complete = false;
            }
            else {
                completed++;
            }
            // console.log(s, t, trial.aois_saved, complete);
        }
        subjectsTrials.push({ subject: s, trials: subjectTrials, complete: complete, partial: completed > 0 });
    }
    return subjectsTrials;
}
function getSubjectAndTrialList(req, res, next) {
    req.params.subjectList = JSON.stringify(subjectList());
    next();
}
exports.getSubjectAndTrialList = getSubjectAndTrialList;
function generateCSV(req, res, next) {
    const csv = require('csv-writer').createObjectCsvWriter;
    const csvWriter = csv({
        path: 'data/animalfeatures_aois_out.csv',
        header: [
            { id: 'prolific_id', title: 'Prolific ID' },
            { id: 'trial', title: 'Trial' },
            { id: 'path_id', title: 'Path ID' },
            { id: 'point_id', title: 'Point ID' },
            { id: 'x', title: 'X' },
            { id: 'y', title: 'Y' },
            { id: 'aoi', title: 'AOI' },
        ]
    });
    const data = [];
    for (const s of subjects.ids) {
        const subject = subjects[`s${s}`];
        for (const t of subject.trial_ids) {
            const trial = subject[t];
            for (let i = 1; i <= trial.n; i++) {
                const path = trial[i];
                for (let j = 1; j <= path.n; j++) {
                    const point = path[j];
                    data.push({
                        prolific_id: subject.prolific_id,
                        trial: trial.trial,
                        path_id: path.path_id,
                        point_id: point.point_id,
                        x: point.x,
                        y: point.y,
                        aoi: point.aoi,
                    });
                }
            }
        }
    }
    csvWriter.writeRecords(data).then(() => {
        console.log('CSV written');
    });
    next();
}
exports.generateCSV = generateCSV;
exports.default = getTrial;
